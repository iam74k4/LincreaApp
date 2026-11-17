// アプリの画面を開く。Web 版が新しいタブで開く /runapp/<アプリID>/<フォームID>/ を表示する。
// 画面を重ねて開くとき（src/app/(app)/run）と、シートで重ねるとき（src/app/(app)/sheet）の両方で使う。
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { SERVER_URL } from '../config';
import { APP_SKINS } from '../webview/appStyles';
import { takeLaunch } from '../launch';
import { takeHandoff } from '../webview/handoff';
import { EzcraftWebView } from './EzcraftWebView';

export function RunApp({ sheet }: { sheet: boolean }) {
  const { app, form, title, q, data, launch } = useLocalSearchParams<{
    app: string;
    form: string;
    title?: string;
    q?: string;
    /** 開いた元から預かったものの番号（src/webview/handoff.ts） */
    data?: string;
    /** 近道の指示（順に押すボタン・入れておく値）の番号（src/launch.ts）。指示そのものは引数に書かない */
    launch?: string;
  }>();
  const [handoff] = useState(() => takeHandoff(data)); // 開いた元から預かったもの（最初の1回だけ取り出す）
  const [orders] = useState(() => takeLaunch(launch));
  const uri = `${SERVER_URL}/runapp/${encodeURIComponent(app)}/${encodeURIComponent(form)}/${q ? `?${q}` : ''}`;
  return (
    <EzcraftWebView
      uri={uri}
      appId={app}
      title={title ?? APP_SKINS[app]?.titles?.[form]}
      handoff={handoff}
      autoClick={orders?.steps?.length ? { steps: orders.steps, ready: orders.ready ?? '', label: orders.label ?? '' } : null}
      prefill={orders?.prefill ?? null}
      sheet={sheet}
    />
  );
}
