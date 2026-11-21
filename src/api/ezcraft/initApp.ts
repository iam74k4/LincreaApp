// EZCraft の画面の「定義」（/RunApp/initApp/）を読む。ページ（jQuery）と同じ頼み方をする。
// 控えに入れる・どれを読むかを決めるのは src/webview/initAppCache.ts（ここは、サーバーに聞くことだけ）。
import { serverFetch as fetch, textWithin } from '../http';
import { SERVER_URL } from '../../core/config';
import { landedOnLogin } from './server';

/** 読んだ結果: ok（中身）/ login（ログインが切れている）/ error（この画面は読めなかった。サーバーが 500 など） */
export type InitAppReply = { status: 'ok'; text: string } | { status: 'login' } | { status: 'error' };

/** 画面（アプリ・フォーム・定義の ID）の定義を読む。つながらない・止めた（signal）ときは、NetworkError などを投げる */
export async function fetchInitApp(form: { app: string; form: string; id: string }, signal: AbortSignal): Promise<InitAppReply> {
  const query = `appid=${encodeURIComponent(form.app)}&formid=${encodeURIComponent(form.form)}&id=${encodeURIComponent(form.id)}&_=${Date.now()}`;
  const res = await fetch(`${SERVER_URL}/RunApp/initApp/?${query}`, {
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
    },
    signal,
  });
  if (landedOnLogin(res)) return { status: 'login' };
  if (!res.ok) return { status: 'error' };
  // 中身は 1MB ほど。本文が届かないまま待たされないように、本文にも待つ長さを決める
  return { status: 'ok', text: await textWithin(res) };
}
