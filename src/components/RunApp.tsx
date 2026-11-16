// アプリの画面を開く。Web 版が新しいタブで開く /runapp/<アプリID>/<フォームID>/ を表示する。
// 画面を重ねて開くとき（src/app/(app)/run）と、シートで重ねるとき（src/app/(app)/sheet）の両方で使う。
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { SERVER_URL } from '../config';
import { APP_SKINS } from '../webview/appStyles';
import { takeHandoff } from '../webview/handoff';
import { EzcraftWebView } from './EzcraftWebView';

export function RunApp({ sheet }: { sheet: boolean }) {
  const { app, form, title, q, data, auto, ready, label, prefill } = useLocalSearchParams<{
    app: string;
    form: string;
    title?: string;
    q?: string;
    data?: string;
    /** 近道: 順に押すボタンの部品 ID（カンマ区切り）、準備ができたしるしの App.data の名前、待つあいだに出す名前（src/shortcuts.ts） */
    auto?: string;
    ready?: string;
    label?: string;
    /** 入力欄に入れておく値（JSON。src/openShortcut.ts） */
    prefill?: string;
  }>();
  const [handoff] = useState(() => takeHandoff(data)); // 開いた元から預かったもの（最初の1回だけ取り出す）
  const [values] = useState(() => parsePrefill(prefill));
  const uri = `${SERVER_URL}/runapp/${encodeURIComponent(app)}/${encodeURIComponent(form)}/${q ? `?${q}` : ''}`;
  return (
    <EzcraftWebView
      uri={uri}
      appId={app}
      title={title ?? APP_SKINS[app]?.titles?.[form]}
      handoff={handoff}
      autoClick={auto ? { steps: auto.split(','), ready: ready ?? '', label: label ?? '' } : null}
      prefill={values}
      sheet={sheet}
    />
  );
}

/** 入れておく値（文字だけ。短いものだけ） */
function parsePrefill(text: string | undefined): Record<string, string> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length <= 40) values[key] = value;
    }
    return Object.keys(values).length > 0 ? values : null;
  } catch {
    return null;
  }
}
