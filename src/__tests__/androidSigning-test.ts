// Android の Release の版を、アップロード鍵で署名する config plugin（plugins/withAndroidReleaseSigning.js）。
// Expo のひな形の app/build.gradle（node_modules/expo/template.tgz の中のもの。npx expo prebuild が使う）に入れて確かめる。
// Expo を上げてひな形が変わったら、ここで気づく（Actions で作る前に）。
import { gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { join } from 'path';

// config plugin は app.json から読まれる CommonJS のファイル
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyReleaseSigning } = require('../../plugins/withAndroidReleaseSigning') as {
  applyReleaseSigning: (gradle: string) => string;
};

/** tar（.tgz）から、1つのファイルを取り出す（ヘッダーは 512 バイトずつ。名前は先頭 100 バイト、大きさは 124 バイト目からの 8 進数） */
function fileInTgz(tgz: string, name: string): string {
  const tar = gunzipSync(readFileSync(tgz));
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512);
    const entry = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    if (!entry) break;
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim(), 8);
    if (entry === name) return tar.subarray(at + 512, at + 512 + size).toString('utf8');
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${name} が ${tgz} にありません`);
}

const TEMPLATE = fileInTgz(join(__dirname, '../../node_modules/expo/template.tgz'), 'package/android/app/build.gradle');

/** Gradle の1つの塊（name { ... }）の中身。括弧の数を数えて取り出す */
function block(gradle: string, start: RegExp): string {
  const m = start.exec(gradle);
  if (!m) throw new Error(`${start} がありません`);
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < gradle.length; i++) {
    if (gradle[i] === '{') depth++;
    if (gradle[i] === '}' && --depth === 0) return gradle.slice(m.index, i + 1);
  }
  throw new Error(`${start} が閉じていません`);
}

test('Expo のひな形に、アップロード鍵の signingConfigs.release を足す', () => {
  const out = applyReleaseSigning(TEMPLATE);
  const configs = block(out, /signingConfigs\s*\{/);
  expect(configs).toMatch(/debug\s*\{[^}]*debug\.keystore/);
  const release = block(configs, /release\s*\{/);
  expect(release).toContain("System.getenv('ANDROID_UPLOAD_KEYSTORE')");
  expect(release).toContain("storePassword System.getenv('ANDROID_UPLOAD_KEYSTORE_PASSWORD')");
  expect(release).toContain("keyAlias System.getenv('ANDROID_UPLOAD_KEY_ALIAS')");
  expect(release).toContain("keyPassword System.getenv('ANDROID_UPLOAD_KEY_PASSWORD')");
});

test('Release の版は、4つの環境変数がそろったときだけアップロード鍵で、ほかはデバッグ用の鍵で署名する', () => {
  const out = applyReleaseSigning(TEMPLATE);
  const types = block(out, /buildTypes\s*\{/);
  const release = block(types, /release\s*\{/);
  expect(release).not.toMatch(/signingConfig\s+signingConfigs\.debug/);
  expect(release).toContain(
    "signingConfig(['ANDROID_UPLOAD_KEYSTORE', 'ANDROID_UPLOAD_KEYSTORE_PASSWORD', 'ANDROID_UPLOAD_KEY_ALIAS', 'ANDROID_UPLOAD_KEY_PASSWORD'].every { System.getenv(it) } ? signingConfigs.release : signingConfigs.debug)",
  );
  // Debug の版は、今までどおりデバッグ用の鍵
  expect(block(types, /debug\s*\{/)).toMatch(/signingConfig\s+signingConfigs\.debug/);
});

test('鍵のファイルの場所やパスワードを、build.gradle に書かない（環境変数から読む）', () => {
  const before = new Set(TEMPLATE.split('\n'));
  const added = applyReleaseSigning(TEMPLATE)
    .split('\n')
    .filter((line) => !before.has(line));
  expect(added.length).toBeGreaterThan(0);
  for (const line of added) expect(line).not.toMatch(/\.keystore'|\.jks'|(store|key)Password\s+'|keyAlias\s+'/);
});

test('2回入れても、同じ（npx expo prebuild を --clean なしで繰り返したとき）', () => {
  const once = applyReleaseSigning(TEMPLATE);
  expect(applyReleaseSigning(once)).toBe(once);
});

test('ひな形が変わって入れる場所が見つからなければ、黙って進まずに止める', () => {
  expect(() => applyReleaseSigning('android { }')).toThrow(/signingConfigs\.debug/);
  const noRelease = TEMPLATE.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/, '$1');
  expect(() => applyReleaseSigning(noRelease)).toThrow(/buildTypes\.release/);
});
