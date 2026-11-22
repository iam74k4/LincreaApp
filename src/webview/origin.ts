// アプリの中の WebView に、どのページを出してよいか・どのページの知らせを信じてよいかを決める。
//
// アプリは EZCraft のページに、見た目を直すスクリプトと、アプリとやりとりする仕組み（src/webview/page/bridgeJs.ts）を入れている。
// これはページを移っても、そのまま入り続ける。もし会社のサイト以外のページが WebView の中に開くと、そのページが
//   - ヘルスケアの歩数をアプリに聞く・画面の定義の控えに偽物を入れる・ほかのアプリを開く、などを頼めてしまい
//   - 開いた元の画面のデータ（ログインした人の情報）を受け取れてしまう
// そこで:
//   - 画面全体（いちばん外の枠）は、会社のサイトのページだけを出す。ほかのサイトは、アプリの外（Safari）で開く
//   - アプリへの知らせは、会社のサイトのページから来たものだけを受け付ける
//   - アプリの外で開くのは https のページだけ（電話・ほかのアプリなどのリンクは開かない）
import { SERVER_URL } from '../core/config';

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

/**
 * current から next へ、# のあとだけが変わったか（同じページの中の移動で、読み込みではない）。
 * 同じ URL（読み直し）や、どちらかが空なら false
 */
export function onlyHashChanged(current: string, next: string): boolean {
  if (!current || !next || current === next) return false;
  return current.split('#')[0] === next.split('#')[0];
}

/** アプリの外（ブラウザ）で開いてよいリンクか（https のページだけ） */
export function mayOpenOutside(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** URL の一部の %エンコードを戻す。壊れた %（%E0 など）は、例外にせず null（ページが作った URL を読むため） */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * /runapp/<アプリ>/<画面>/ の URL から、アプリと画面を取り出す（runapp でない・読めない URL は null）。
 * どの画面か（控えの名前）・どのアプリのページからの知らせか、を決めるのに使う
 */
export function runappOf(url: string): { app: string; form: string } | null {
  // URL のパスの頭だけを見る（引数（?…）の中の /runapp/ や、別の場所の /runapp/ には当てない）。大文字・小文字は区別しない
  let path: string;
  try {
    path = new URL(url, SERVER_URL).pathname;
  } catch {
    return null;
  }
  const match = /^\/runapp\/([^/]+)\/([^/]+)/i.exec(path);
  if (!match) return null;
  const app = decodeSegment(match[1]);
  const form = decodeSegment(match[2]);
  return app !== null && form !== null ? { app, form } : null;
}

/**
 * 知らせを送ってきたページを、画面（screenUri で開いた画面）のアプリのページとして信じてよいなら、そのアプリ。だめなら ''。
 * 信じるのは、ページが変えられない「画面を開いた URL」のアプリだけ。送ってきたページの URL（senderUrl）は、ページが
 * history.replaceState で書き換えられるので、それだけでは信じず、画面のアプリと一致したときだけ認める。
 * /page の画面（runapp でない）は、どのアプリでもない（''）
 */
export function trustedSenderApp(screenUri: string, senderUrl: string): string {
  const screenApp = runappOf(screenUri)?.app ?? '';
  const senderApp = runappOf(senderUrl)?.app ?? '';
  return screenApp && senderApp.toLowerCase() === screenApp.toLowerCase() ? screenApp : '';
}

/**
 * 画面（screenUri）のいちばん外の枠が、ほかのアプリの画面（/runapp/<ほかのアプリ>/）へ移ろうとしているか。
 * そのまま移すと、ほかのアプリのページが、この画面のアプリとして知らせを送れてしまうので、新しい画面として開く
 */
export function leavesForOtherApp(screenUri: string, url: string, isTopFrame: boolean | undefined): boolean {
  if (isTopFrame === false || !isServerUrl(url)) return false;
  const next = runappOf(url);
  if (!next) return false;
  const screenApp = runappOf(screenUri)?.app ?? '';
  return next.app.toLowerCase() !== screenApp.toLowerCase();
}

/** ページが開こうとした先（新しいウインドウ）の種類 */
export type Target =
  /** EZCraft のアプリの画面（/runapp/<アプリ>/<フォーム>/）。アプリの画面として上に重ねる */
  | { kind: 'runapp'; app: string; form: string; query: string }
  /** 会社のサイトの、ほかのページ */
  | { kind: 'page'; path: string }
  /** ほかのサイト。アプリの外で開く（mayOpenOutside のものだけ） */
  | { kind: 'external'; url: string };

/** 開こうとしている URL が、どの種類の画面かを決める（読めない URL は null）。相対の URL は会社のサイトのもの */
export function resolveTarget(targetUrl: string): Target | null {
  let url: URL;
  try {
    url = new URL(targetUrl, SERVER_URL);
  } catch {
    return null;
  }
  if (url.host !== new URL(SERVER_URL).host) return { kind: 'external', url: url.toString() };
  // 大文字・小文字は区別しない（runappOf と同じ。/RunApp/ の画面を、アプリの画面として開く）
  const match = url.pathname.match(/^\/runapp\/([^/]+)\/([^/]+)\/?$/i);
  if (match) {
    const app = decodeSegment(match[1]);
    const form = decodeSegment(match[2]);
    if (app === null || form === null) return null; // 壊れた %（ページの作りそこない）は開かない
    return { kind: 'runapp', app, form, query: url.search.replace(/^\?/, '') };
  }
  return { kind: 'page', path: url.pathname + url.search };
}
