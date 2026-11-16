// ログインの通信を1歩ずつ見るための道具。アプリと同じ流れを Mac の上で動かす。
//
//   node scripts/debug-login.mjs
//
// アプリの fetch はリダイレクトや Cookie を自動で処理してしまい、途中が見えない。
// ここでは1歩ずつ自分でたどって、各ページの HTTP ステータスと行き先、Cookie の出入りを表示する。
// パスワード・トークン・Cookie の値は表示しない（出すのはステータス、パス、Cookie の名前と属性だけ）。
//
// ③④ は2通りで試す（ID トークンは1回の本人確認で取ったものを使い回す）:
//   A. アプリと同じ: トークンを渡したあと、サーバーが指すリダイレクトを最後までたどる → /main/ を開く
//   B. 寄り道なし:   トークンを渡したら、リダイレクトはたどらずに → /main/ を開く
// B だけ通るなら、リダイレクトの途中（たとえば /login を開くこと）でログインが消えている。
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import cognito from 'amazon-cognito-identity-js';

const { AuthenticationDetails, CognitoUser, CognitoUserPool } = cognito;

const SERVER_URL = 'https://lincrea-all.ezcraft.com';
const HOME_URL = `${SERVER_URL}/main/`; // ログインが要るページ（/ はいつも /login へ 301 なので確認に使えない）
const LOGIN_URL = `${SERVER_URL}/login?r=${encodeURIComponent(HOME_URL)}`;
const HEADERS = { Accept: '*/*', 'User-Agent': 'login-demo/1 CFNetwork/3826 Darwin/25.0.0' };

// ---- Cookie を覚えておく入れ物（1つのサイト用の簡単なもの） ----
class Jar {
  #cookies = new Map();

  header() {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  /** レスポンスの Set-Cookie を取り込み、何が変わったかを名前（と sails.sid の属性）で返す */
  take(res) {
    const notes = [];
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const before = this.#cookies.get(name);
      if (value === '') this.#cookies.delete(name);
      else this.#cookies.set(name, value);
      if (name.startsWith('AWSALB')) continue; // 負荷分散の Cookie は毎回変わるので省く
      const change =
        value === '' ? '消された' : before === undefined ? '新規' : before === value ? '同じ' : '変わった';
      const detail = name === 'sails.sid' ? `; ${attrs.map((a) => a.trim()).join('; ')}` : '';
      notes.push(`${name}(${change}${detail})`);
    }
    return notes;
  }
}

/** リダイレクトを1つずつたどって表示する（follow=false なら最初の1つで止まる） */
async function get(jar, url, { follow = true } = {}) {
  let current = url;
  for (let hop = 0; hop < 10; hop++) {
    const res = await fetch(current, { redirect: 'manual', headers: { ...HEADERS, Cookie: jar.header() } });
    const notes = jar.take(res);
    const location = res.headers.get('location');
    const next = location ? new URL(location, current).toString() : null;
    console.log(
      `   GET ${pathOf(current)} → ${res.status}` +
        (next ? ` → ${pathOf(next)}` : '') +
        (notes.length ? `   set-cookie: ${notes.join(', ')}` : ''),
    );
    if (!follow || !next || res.status < 300 || res.status >= 400) return { res, finalUrl: current, next };
    current = next;
  }
  throw new Error('リダイレクトが多すぎます');
}

function pathOf(url) {
  return new URL(url).pathname; // クエリにはトークンが入るので出さない
}

function readMeta(html, name) {
  const match = html.match(new RegExp(`<meta name="${name}" content="([^"]+)"`));
  return match ? match[1] : null;
}

function cognitoLogin(userPoolId, clientId, username, password) {
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  const user = new CognitoUser({ Username: username, Pool: pool });
  const details = new AuthenticationDetails({ Username: username, Password: password });
  return new Promise((resolve, reject) => {
    const extra = (kind) => () => reject(new Error(`追加の確認が必要です（${kind}）`));
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: (err) => reject(new Error(`Cognito: ${err?.code ?? ''} ${err?.message ?? ''}`)),
      newPasswordRequired: extra('新しいパスワード'),
      mfaRequired: extra('SMS'),
      totpRequired: extra('TOTP'),
      mfaSetup: extra('MFA の設定'),
      selectMFAType: extra('MFA の種類'),
      customChallenge: extra('カスタム'),
    });
  });
}

/** 打った文字を表示しないで1行読む */
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const done = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') return done(), resolve(value);
        if (c === '\u0003') return done(), reject(new Error('中止しました'));
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

/** /main/ を開いて、ログインできているかを1行で言う */
async function checkHome(jar) {
  console.log('   -- ログインが要るページ /main/ を開く');
  const { finalUrl } = await get(jar, HOME_URL);
  const ok = !pathOf(finalUrl).startsWith('/login');
  console.log(ok ? '   結果: ログインできている' : '   結果: ログイン画面に戻された');
  return ok;
}

// ---- ここから本体 ----
console.log('① ログイン画面を開く');
const { res: page } = await get(new Jar(), LOGIN_URL);
const html = await page.text();
const userPoolId = readMeta(html, 'userPoolId');
const clientId = readMeta(html, 'appClientId');
console.log(`   Cognito の設定: ${userPoolId && clientId ? '読めた' : '読めない'}`);

if (!stdin.isTTY) {
  console.log('\nここから先はユーザー名とパスワードを打つので、ターミナルで直接動かしてください。');
  process.exit(0);
}

const rl = readline.createInterface({ input: stdin, output: stdout });
const username = (await rl.question('\nユーザー名: ')).trim();
rl.close();
const password = await askHidden('パスワード（表示されません）: ');

console.log('\n② Cognito で本人確認');
const idToken = await cognitoLogin(userPoolId, clientId, username, password);
console.log('   OK（ID トークンを受け取った）');

const handoffUrl = `${SERVER_URL}/auth/cognito?identifier=${encodeURIComponent(idToken)}&provider=cognito&remember=0`;
const results = {};

console.log('\n③④ A. アプリと同じ（リダイレクトを最後までたどる）');
{
  const jar = new Jar();
  await get(jar, LOGIN_URL);
  console.log('   -- トークンを渡す');
  await get(jar, handoffUrl);
  results.A = await checkHome(jar);
}

console.log('\n③④ B. 寄り道なし（トークンを渡したら、リダイレクトはたどらない）');
{
  const jar = new Jar();
  await get(jar, LOGIN_URL);
  console.log('   -- トークンを渡す');
  await get(jar, handoffUrl, { follow: false });
  results.B = await checkHome(jar);
}

console.log('\nまとめ');
console.log(`   A（アプリと同じ）: ${results.A ? '○' : '×'}   B（寄り道なし）: ${results.B ? '○' : '×'}`);
