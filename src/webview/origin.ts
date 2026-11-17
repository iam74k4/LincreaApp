// アプリの中の WebView に、どのページを出してよいか・どのページの知らせを信じてよいかを決める。
//
// アプリは EZCraft のページに、見た目を直すスクリプトと、アプリとやりとりする仕組み（src/webview/bridge.ts）を入れている。
// これはページを移っても、そのまま入り続ける。もし会社のサイト以外のページが WebView の中に開くと、そのページが
//   - ヘルスケアの歩数をアプリに聞く・画面の定義の控えに偽物を入れる・ほかのアプリを開く、などを頼めてしまい
//   - 開いた元の画面のデータ（ログインした人の情報）を受け取れてしまう
// そこで:
//   - 画面全体（いちばん外の枠）は、会社のサイトのページだけを出す。ほかのサイトは、アプリの外（Safari）で開く
//   - アプリへの知らせは、会社のサイトのページから来たものだけを受け付ける
//   - アプリの外で開くのは https のページだけ（電話・ほかのアプリなどのリンクは開かない）
import { SERVER_URL } from '../config';

const SERVER_ORIGIN = new URL(SERVER_URL).origin;

/** 会社のサイト（SERVER_URL と同じ https・ホスト・ポート）のページか */
export function isServerUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === SERVER_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * WebView がそのページに移ってよいか。
 * いちばん外の枠は、会社のサイトと about:blank だけ。枠の中の小さな枠（iframe）は止めない
 * （アプリの仕組みは、いちばん外の枠にしか入らないため）
 */
export function mayNavigate(url: string, isTopFrame: boolean | undefined): boolean {
  if (isTopFrame === false) return true;
  if (url === 'about:blank') return true;
  return isServerUrl(url);
}

/** アプリの外（Safari）で開いてよいリンクか（https のページだけ） */
export function mayOpenOutside(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
