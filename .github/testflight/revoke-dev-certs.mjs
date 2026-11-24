// この実行が署名のために作った開発用の証明書を、Apple から取り消す（.github/workflows/testflight.yml の release の最後）。
//
// Xcode は archive のとき、開発用（Apple Development）の証明書で署名する。実行環境は毎回まっさらで、前の証明書の秘密鍵がないので、
// API キーで新しい証明書を Apple に作らせる。秘密鍵は実行環境といっしょに消えるので、残った証明書は二度と使えないのに、上限の数には入る
// （上限に達すると、archive が「Choose a certificate to revoke」で止まる。2026-11-24 に、10 回ほど送ったところで一度止まった）。
// 送る版は、書き出しのときに Apple の配布用の証明書（クラウド）で署名し直すので、開発用の証明書を取り消しても、送った版には響かない。
//
// 取り消すのは、この実行環境のキーチェーンにある Apple Development の証明書だけ（シリアル番号で Apple の一覧と突き合わせる）。
// 人のパソコンの証明書・配布用の証明書には触れない。
// うまくいかなくても、版は送れているので、警告を出すだけで止めない（そのときは手で取り消す。docs/distribution.md の「止まったとき」）。
//
//   ASC_KEY_ID・ASC_ISSUER_ID・ASC_KEY_PATH（AuthKey.p8 の場所）を入れて node .github/testflight/revoke-dev-certs.mjs
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createPrivateKey, sign, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

const API = 'https://api.appstoreconnect.apple.com/v1';

/** シリアル番号を、書き方のちがい（大文字・小文字、頭の 0、: の区切り）を除いた形にする */
function normalizeSerial(serial) {
  return serial.replace(/:/g, '').toUpperCase().replace(/^0+/, '');
}

/** このキーチェーンにある Apple Development の証明書のシリアル番号 */
function keychainSerials() {
  let out;
  try {
    out = execFileSync('security', ['find-certificate', '-a', '-c', 'Apple Development', '-p'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return []; // 1つもないと、security はエラーで終わる
  }
  const pems = out.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  return pems
    .map((pem) => new X509Certificate(pem))
    .filter((cert) => /CN=Apple Development:/.test(cert.subject))
    .map((cert) => normalizeSerial(cert.serialNumber));
}

/** App Store Connect API の鍵（JWT。10 分だけ使える） */
function token() {
  const now = Math.floor(Date.now() / 1000);
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${part({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })}.${part({
    iss: process.env.ASC_ISSUER_ID,
    iat: now,
    exp: now + 10 * 60,
    aud: 'appstoreconnect-v1',
  })}`;
  const key = createPrivateKey(readFileSync(process.env.ASC_KEY_PATH));
  const signature = sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' });
  return `${body}.${signature.toString('base64url')}`;
}

async function api(method, url, auth) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${auth}` } });
  if (!res.ok) throw new Error(`${method} ${url.replace(API, '')}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

/** Apple にある開発用の証明書（Apple Development と、前の iOS Development） */
async function developmentCertificates(auth) {
  const certs = [];
  let url = `${API}/certificates?filter[certificateType]=DEVELOPMENT,IOS_DEVELOPMENT&fields[certificates]=name,displayName,serialNumber&limit=200`;
  while (url) {
    const page = await api('GET', url, auth);
    certs.push(...page.data);
    url = page.links?.next;
  }
  return certs;
}

async function main() {
  const serials = keychainSerials();
  if (serials.length === 0) {
    console.log('この実行環境に、開発用の証明書はない（作る前に止まったときなど）。取り消すものはない');
    return;
  }
  const auth = token();
  const mine = (await developmentCertificates(auth)).filter((cert) =>
    serials.includes(normalizeSerial(cert.attributes.serialNumber ?? '')),
  );
  if (mine.length === 0) {
    console.log(`::warning::キーチェーンの開発用の証明書（${serials.join(', ')}）が、Apple の一覧に見つからない。取り消さなかった`);
    return;
  }
  for (const cert of mine) {
    await api('DELETE', `${API}/certificates/${cert.id}`, auth);
    console.log(`取り消した: ${cert.attributes.displayName ?? cert.attributes.name}（${cert.attributes.serialNumber}）`);
  }
}

main().catch((error) => {
  console.log(
    `::warning::開発用の証明書を取り消せなかった（${error.message}）。上限で止まる前に、Apple Developer の「Certificates」で手で取り消す`,
  );
});
