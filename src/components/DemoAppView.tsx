// 審査用のデモの画面（src/demo/）。サーバーのページの代わりに、見本のデータで作ったページを WebView に出す。
// RunApp（src/components/RunApp.tsx）が、デモでログインしているときにここを使う。
//
// 本物の画面（EzcraftWebView）と同じく、ページの「次の画面」は画面を重ねて（またはシートで）開く。
// 登録・申請は見本のデータに入れる（src/demo/demoStore.ts）。サーバーには何も送らない。
// ページは html で渡すので、ほかのサイトへは移らない（リンクで移ろうとしても止める）。
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useColors } from '../core/theme';
import { demoPage, demoStepsDayAllowed } from '../demo/demoPages';
import { jsonForScript } from '../demo/demoHtml';
import { demoState, demoVersion, runDemoAction, subscribeDemo } from '../demo/demoStore';
import { healthAvailable, healthSourceName, stepsOn } from '../platform/health';

type Props = {
  app: string;
  form: string;
  /** 画面に渡す引数（「day=2026-11-24」など） */
  q: string;
  title?: string;
};

type PageMessage =
  | { type: 'open'; app: string; form: string; q: string; sheet: boolean }
  | { type: 'action'; id: string; action: string; data: Record<string, unknown>; back: boolean }
  | { type: 'steps'; id: string; day: string }
  | { type: 'back' };

const ID = /^[A-Za-z0-9_]{1,64}$/;

/** ページからの知らせを読む（形が違うものは捨てる） */
function parseMessage(raw: string): PageMessage | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (m.type) {
    case 'open':
      if (!ID.test(s(m.form)) || (m.app && !ID.test(s(m.app)))) return null;
      return { type: 'open', app: s(m.app), form: s(m.form), q: s(m.q).slice(0, 200), sheet: m.sheet === true };
    case 'action':
      if (!ID.test(s(m.id)) || typeof m.data !== 'object' || m.data === null) return null;
      return { type: 'action', id: s(m.id), action: s(m.action), data: m.data as Record<string, unknown>, back: m.back === true };
    case 'steps':
      return ID.test(s(m.id)) ? { type: 'steps', id: s(m.id), day: s(m.day) } : null;
    case 'back':
      return { type: 'back' };
    default:
      return null;
  }
}

const HEALTH = healthAvailable();

export function DemoAppView({ app, form, q, title }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const webRef = useRef<ComponentRef<typeof WebView>>(null);
  // 見本のデータが変わったら（ほかの画面で登録したときも）、ページを作り直す。
  // ただし、登録して閉じるところなら作り直さない（「登録しました」を出しているページを、閉じる前に読み直さない）
  const leaving = useRef(false);
  const [version, setVersion] = useState(demoVersion);
  useEffect(() => {
    const unsubscribe = subscribeDemo(() => {
      if (!leaving.current) setVersion(demoVersion());
    });
    return () => {
      unsubscribe();
    };
  }, []);
  const page = useMemo(
    () => demoPage(demoState(), app, form, q, { health: HEALTH, healthSource: healthSourceName(), bottomInset: insets.bottom }),
    // version: 見本のデータが変わったら作り直す（中身は demoState() から読む）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app, form, q, insets.bottom, version],
  );
  const source = useMemo(() => ({ html: page.html, baseUrl: '' }), [page.html]);

  const reply = (js: string) => webRef.current?.injectJavaScript(`${js};true;`);

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    const message = parseMessage(e.nativeEvent.data);
    if (!message) return;
    if (message.type === 'open') {
      router.push({
        pathname: message.sheet ? '/sheet/[app]/[form]' : '/run/[app]/[form]',
        params: { app: message.app || app, form: message.form, ...(message.q ? { q: message.q } : {}) },
      });
    }
    if (message.type === 'action') {
      if (message.back) leaving.current = true;
      const result = runDemoAction(message.action, message.data);
      if (!result.ok) leaving.current = false;
      reply(`window.__demoResult(${jsonForScript(message.id)}, ${result.ok}, ${jsonForScript(result.message)})`);
    }
    if (message.type === 'steps') {
      const { id, day } = message;
      (demoStepsDayAllowed(demoState(), day) ? stepsOn(day) : Promise.resolve(null)).then((steps) =>
        reply(`window.__demoSteps(${jsonForScript(id)}, ${jsonForScript(steps)})`),
      );
    }
    if (message.type === 'back' && router.canGoBack()) router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: page.title || title }} />
      <WebView
        ref={webRef}
        source={source}
        style={[styles.web, { backgroundColor: c.background }]}
        contentInsetAdjustmentBehavior="never"
        bounces={false}
        overScrollMode="never"
        originWhitelist={['*']}
        // 渡した html のほかは開かない（デモのページには、外へのリンクを置いていない。サーバーのページも読まない）
        onShouldStartLoadWithRequest={(req: { url: string }) => /^(about|data|blob):/i.test(req.url)}
        onMessage={onMessage}
      />
    </>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1 },
});
