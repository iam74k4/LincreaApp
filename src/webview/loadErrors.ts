// ページを読み込めなかったとき、WebView が返す番号（と英語の説明）を、使う人に分かる言葉にする。
//
// 番号は端末の WebView ごとに違う。iPhone（WKWebView）は NSURLError（-1009 など）、
// Android（WebViewClient）は ERROR_*（-2 ホストが見つからない、-8 時間切れ など）。
// 2つの番号の表で、このファイルが引く番号は重ならない（iPhone は -999・-1000 番台・102、Android は -1〜-16）ので、
// 端末を見分けずに、1つの表で引く（Android の SSL の失敗は 0〜5 で、どれにも当たらず「サーバーにつながりません」になる）。
// Android は、電波がなくても番号が -2（ホストが見つからない）になるので、英語の説明（net::ERR_…）も合わせて見る。
// iPhone の取り消し（-999）と受け取り（102）は、react-native-webview が JS に渡す前に捨てるので、ここに来ることはほぼない
// （来ても失敗にしないための備え）。
import type { IconName } from '../platform/icons';

/** 読み込めなかったときに出すもの */
export type LoadFailure = { icon: IconName; title: string; message: string };

/** 電波がない・機内モード・モバイル通信が切られている（iPhone: NSURLError） */
const OFFLINE_CODES = new Set([-1009, -1020, -1018]);
/** 時間がかかりすぎて止めた（iPhone: -1001 / Android: ERROR_TIMEOUT） */
const TIMEOUT_CODES = new Set([-1001, -8]);
/** 読み込みを取り消した（次のページへ移った・同じページを読み直した）。失敗ではない（iPhone: NSURLErrorCancelled） */
const CANCELLED_CODE = -999;
/** ページではなくファイルとして受け取った（PDF など。ページに入れたスクリプトが受け取る。src/webview/page/bridgeJs.ts の 6。iPhone: WebKitErrorFrameLoadInterruptedByPolicyChange） */
const FILE_RECEIVED_CODE = 102;

/** 失敗ではない読み込みの終わり方か（取り消し・ファイルとして受け取った）。失敗の画面は出さない */
export function isIgnorableLoadError(code: number, description = ''): boolean {
  // Android は、取り消しも番号は -1（ERROR_UNKNOWN）で、説明が net::ERR_ABORTED になる
  return code === CANCELLED_CODE || code === FILE_RECEIVED_CODE || description.includes('ERR_ABORTED');
}

/** 読み込みの失敗を、利用者に分かる言葉にする */
export function describeLoadError(code: number, description = ''): LoadFailure {
  if (OFFLINE_CODES.has(code) || description.includes('ERR_INTERNET_DISCONNECTED')) {
    return {
      icon: 'offline',
      title: 'インターネットにつながっていません',
      message: '電波のよい所で、もう一度読み込んでください。',
    };
  }
  if (TIMEOUT_CODES.has(code) || description.includes('ERR_TIMED_OUT')) {
    return {
      icon: 'server-error',
      title: 'サーバーの返事がありません',
      message: '時間がかかりすぎたので、止めました。少し待ってから、もう一度読み込んでください。',
    };
  }
  return {
    icon: 'server-error',
    title: 'サーバーにつながりません',
    message: '通信が途中で切れたか、サーバーが止まっています。少し待ってから、もう一度読み込んでください。',
  };
}
