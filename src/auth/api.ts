// サーバーとの通信。画面はこのファイルの中身を知らなくてよい。
//
// Web 版のログイン（/js/cmn/util/cognito.js）と同じ順番で進める:
//   1. ログイン画面を開く      GET  /login?r=<戻り先>   … サーバーに届くか。Cognito の設定値もここから読む。
//                                                         r は「ログイン後の行き先」。サーバーが Cookie に覚える
//   2. Cognito で本人確認      AWS Cognito (SRP)        … ID トークンをもらう
//   3. サーバーに渡す          GET  /auth/cognito?identifier=<IDトークン> … サーバーのセッション（Cookie）ができる
//   4. ログイン後のページを開く GET  /main/              … Cookie が効いていて、/login に戻されないか
//
// Face ID でログインし直すとき（src/auth/faceId.ts）は、2 をパスワードの代わりに「更新用の鍵」（リフレッシュトークン）で行う。
// 1・3・4 は同じ。
//
// 「ログインできたか」は 4 で決める。fetch はリダイレクトを自動でたどり、最後のページの
// HTTP ステータスしか返さないので、ログイン画面に戻されても HTTP 200 になる。見るべきは行き先のパス。
//
// 確かめる先は / ではなく /main/。/ はログインしていてもいなくても /login へ 301 で送られる（固定の転送）。
// /main/ はログインが要るページで、していなければ /login?r=... へ 302 で戻される。
//
// Cookie は iOS / Android の通信の仕組みが自動で覚えて、次の fetch から付けてくれる。
// ただし 3 だけは、リダイレクトを自動でたどらせない（下の 3 の説明を参照）。
// そのために、React Native 標準の fetch ではなく、redirect: 'manual' が効く expo/fetch を使う。
//
// パスワードとトークンは、画面にもログにも出さない。
import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { fetch } from 'expo/fetch';
import { NativeModules } from 'react-native';

import { pathOf } from '../api/http';
import { SERVER_URL } from '../config';
import { cognitoStorage, loadCognitoStorage } from './cognitoStorage';

/** ログインしていないと開けないページ。ログイン後の行き先にも、ログインできたかの確認にも使う */
const HOME_URL = `${SERVER_URL}/main/`;

export type Session = {
  username: string;
};

/** 利用者に伝えるべき失敗（パスワード違いなど）。message をそのまま画面に出す */
export class LoginError extends Error {}

/** Face ID の「更新用の鍵」が使えなくなった（期限切れ・取り消し）。パスワードでログインし直してもらう */
export class RefreshExpiredError extends LoginError {}

/**
 * ログインの結果。refreshToken は Cognito の「更新用の鍵」で、Face ID でログインし直すときに使う
 * （Face ID を使うときだけ、Face ID 付きで端末に保存する。画面やログには出さない）
 */
export type LoginResult = { session: Session; refreshToken: string };

// ログインを始めてからの時間（どの段に時間がかかっているかを、開発中に Metro で見るため）
let startedAt = 0;
const done = (label: string, detail: string) => console.log(`[login] OK ${label}: ${detail}（${Date.now() - startedAt}ms）`);

/** パスワードでログインする */
export async function login(username: string, password: string, remember: boolean): Promise<LoginResult> {
  startedAt = Date.now();
  const pool = await openLoginPage();
  await loadCognitoStorage(); // この端末の登録（Cognito が端末を覚えているとき）
  const tokens = await authenticateWithCognito(pool.userPoolId, pool.clientId, username, password);
  done('Cognito で本人確認できた', 'ID トークンを受け取った');
  await startServerSession(tokens.idToken, remember);
  return { session: { username }, refreshToken: tokens.refreshToken };
}

/**
 * Face ID のあとに、保存しておいた「更新用の鍵」でログインし直す（パスワードは使わない）。
 * 鍵が新しくなったら、新しいほうを返す（呼んだ側が保存し直す）
 */
export async function loginWithRefreshToken(username: string, refreshToken: string, remember: boolean): Promise<LoginResult> {
  startedAt = Date.now();
  const pool = await openLoginPage();
  await loadCognitoStorage(); // 鍵と一緒に、この端末の登録（deviceKey）を Cognito に渡す
  const tokens = await refreshWithCognito(pool.userPoolId, pool.clientId, username, refreshToken);
  done('Cognito で鍵を使って本人確認できた', 'ID トークンを受け取った');
  await startServerSession(tokens.idToken, remember);
  return { session: { username }, refreshToken: tokens.refreshToken };
}

/** 1. ログイン画面を開く（Web 版と同じく、ログイン後の行き先 r を付ける）。Cognito の設定値を読む */
async function openLoginPage(): Promise<{ userPoolId: string; clientId: string }> {
  const loginPage = await fetch(`${SERVER_URL}/login?r=${encodeURIComponent(HOME_URL)}`, {
    credentials: 'include',
  });
  if (!loginPage.ok) {
    throw new Error(`ログイン画面を開けませんでした（HTTP ${loginPage.status}）`);
  }
  const html = await loginPage.text();
  const userPoolId = readMeta(html, 'userPoolId');
  const clientId = readMeta(html, 'appClientId');
  if (!userPoolId || !clientId) {
    throw new Error('ログイン画面から Cognito の設定を読めませんでした。サイトの作りが変わった可能性があります。');
  }
  done('サーバーに届いた', `GET /login → HTTP ${loginPage.status}`);
  return { userPoolId, clientId };
}

/** 3・4. ID トークンをサーバーに渡してセッションを作り、ログインが要るページを開けるか確かめる */
async function startServerSession(idToken: string, remember: boolean): Promise<void> {
  // 3. ID トークンをサーバーに渡して、セッションを作ってもらう。
  //    サーバーは 302（/main/ へ移動）の応答の中で、新しいセッション Cookie を発行する。
  //    iOS にリダイレクトを自動でたどらせると、次のページへ古い Cookie のまま進んでしまい、ログインが消えた。
  //    そこで 302 をそのまま受け取り（redirect: 'manual'）、Cookie が保存されてから自分で次へ進む。
  const query = `identifier=${encodeURIComponent(idToken)}&provider=cognito&remember=${remember ? 1 : 0}`;
  const handoff = await fetch(`${SERVER_URL}/auth/cognito?${query}`, {
    credentials: 'include',
    redirect: 'manual',
  });
  await handoff.text(); // 応答を最後まで受け取っておく
  const location = handoff.headers.get('location');
  const nextPath = location ? pathOf(new URL(location, SERVER_URL).toString()) : '(なし)';
  if (handoff.status < 300 || handoff.status >= 400 || nextPath.startsWith('/login')) {
    // トークンが受け付けられないと、サーバーは /login へ戻す
    throw new Error(`サーバーがトークンを受け付けませんでした（HTTP ${handoff.status}、行き先 ${nextPath}）`);
  }
  done('サーバーがトークンを受け付けた', `HTTP ${handoff.status} → ${nextPath}`);

  // 4. ログインが要るページを開いて、ログインしたままか確かめる
  const home = await fetch(HOME_URL, { credentials: 'include' });
  const homePath = pathOf(home.url);
  if (!home.ok) {
    throw new Error(`ログイン後のページを開けませんでした（HTTP ${home.status}）`);
  }
  if (homePath.startsWith('/login')) {
    throw new Error(
      'Cognito の本人確認は通りましたが、サーバー側のログインができていません（/main/ を開くとログイン画面に戻されます）。',
    );
  }
  done('ログインしたままページを開けた', `GET /main/ → ${homePath}`);
}

/** サーバー側のログインを終わらせる（Web 版のログアウトと同じ GET /logout）。失敗しても止めない */
export async function logout(): Promise<void> {
  try {
    await fetch(`${SERVER_URL}/logout`, { credentials: 'include' });
  } catch (e) {
    console.log(`[logout] NG ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Cognito のコールバック式の API を、await で待てる形に包む */
function authenticateWithCognito(
  userPoolId: string,
  clientId: string,
  username: string,
  password: string,
): Promise<{ idToken: string; refreshToken: string }> {
  // パスワードの確かめ（SRP）は、大きな数の計算をする。部品のネイティブの計算（RNAWSCognito）が入っていないアプリ
  // （Expo Go など）では JavaScript で計算するので、何秒もかかる。開発中は、どちらで計算しているかを出す
  if (__DEV__) {
    const native = typeof (NativeModules.RNAWSCognito as { computeModPow?: unknown } | undefined)?.computeModPow === 'function';
    console.log(`[login] Cognito の計算: ${native ? 'ネイティブ（速い）' : 'JavaScript（遅い。Expo Go など）'}`);
  }
  // トークンはメモリの中だけに置く（部品のふつうの保存場所は、暗号化せずに端末に書く。src/auth/cognitoStorage.ts）
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId, Storage: cognitoStorage });
  const user = new CognitoUser({ Username: username, Pool: pool, Storage: cognitoStorage });
  const details = new AuthenticationDetails({ Username: username, Password: password });

  const needsWeb = () =>
    new LoginError(
      'このアカウントは追加の確認（新しいパスワードの設定や多要素認証）が必要です。このアプリはまだ対応していないので、Web 版でログインしてください。',
    );

  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session: CognitoUserSession) => resolve(tokensOf(session)),
      onFailure: (err: { code?: string; message?: string }) => {
        console.log(`[login] NG Cognito: ${err?.code ?? 'unknown'} ${err?.message ?? ''}`);
        if (err?.message === 'Password attempts exceeded') {
          reject(new LoginError('ログインの試行回数が上限を超えました。しばらく待ってからお試しください。'));
        } else if (err?.code === 'NotAuthorizedException' || err?.code === 'UserNotFoundException') {
          reject(new LoginError('ユーザー名またはパスワードが違います。'));
        } else if (err?.code === 'PasswordResetRequiredException') {
          reject(new LoginError('パスワードの再設定が必要です。Web 版で再設定してください。'));
        } else {
          reject(new Error(`Cognito: ${err?.code ?? ''} ${err?.message ?? ''}`.trim()));
        }
      },
      newPasswordRequired: () => reject(needsWeb()),
      mfaRequired: () => reject(needsWeb()),
      totpRequired: () => reject(needsWeb()),
      mfaSetup: () => reject(needsWeb()),
      selectMFAType: () => reject(needsWeb()),
      customChallenge: () => reject(needsWeb()),
    });
  });
}

/** 「更新用の鍵」で、新しい ID トークンをもらう（Cognito の REFRESH_TOKEN_AUTH） */
function refreshWithCognito(
  userPoolId: string,
  clientId: string,
  username: string,
  refreshToken: string,
): Promise<{ idToken: string; refreshToken: string }> {
  // トークンはメモリの中だけに置く（部品のふつうの保存場所は、暗号化せずに端末に書く。src/auth/cognitoStorage.ts）
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId, Storage: cognitoStorage });
  const user = new CognitoUser({ Username: username, Pool: pool, Storage: cognitoStorage });
  return new Promise((resolve, reject) => {
    user.refreshSession(new CognitoRefreshToken({ RefreshToken: refreshToken }), (err: { code?: string; message?: string } | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        console.log(`[login] NG Cognito (鍵): ${err?.code ?? 'unknown'} ${err?.message ?? ''}`);
        // 鍵の期限が切れた・取り消された（パスワードを変えた、管理者がログアウトさせた など）
        if (err?.code === 'NotAuthorizedException') {
          reject(new RefreshExpiredError('Face ID でのログインの期限が切れました。パスワードでログインしてください。'));
        } else {
          reject(new Error(`Cognito: ${err?.code ?? ''} ${err?.message ?? ''}`.trim()));
        }
        return;
      }
      resolve(tokensOf(session));
    });
  });
}

function tokensOf(session: CognitoUserSession): { idToken: string; refreshToken: string } {
  return { idToken: session.getIdToken().getJwtToken(), refreshToken: session.getRefreshToken().getToken() };
}

function readMeta(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta name="${name}" content="([^"]+)"`));
  return match ? match[1] : null;
}
