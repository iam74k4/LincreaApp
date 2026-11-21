// Android の Release の版を、自分の鍵（アップロード鍵）で署名する config plugin（docs/android-release.md）。
//
// android フォルダは作り直すたびに消える（npx expo prebuild）ので、署名の設定は、ここで app/build.gradle に入れる。
// 鍵のファイルとパスワードは、リポジトリにも build.gradle にも書かない。作るときに環境変数で渡す（GitHub Actions の Environment の Secrets）:
//   ANDROID_UPLOAD_KEYSTORE           鍵のファイル（.keystore / .jks）の場所
//   ANDROID_UPLOAD_KEYSTORE_PASSWORD  鍵のファイルのパスワード
//   ANDROID_UPLOAD_KEY_ALIAS          鍵の名前
//   ANDROID_UPLOAD_KEY_PASSWORD       鍵のパスワード
// 4つがそろっていなければ、今までどおり Expo のひな形のデバッグ用の鍵で署名する（手元・プルリクエストでの確かめ用。Google Play には出せない）。
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// LincreaApp: release signing (plugins/withAndroidReleaseSigning.js)';

const SIGNING_CONFIG = `
        ${MARKER}
        release {
            def keystore = System.getenv('ANDROID_UPLOAD_KEYSTORE')
            if (keystore) {
                storeFile file(keystore)
                storePassword System.getenv('ANDROID_UPLOAD_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_UPLOAD_KEY_PASSWORD')
            }
        }`;

const RELEASE_SIGNING = `// ${MARKER.slice(3)}: the upload key when the environment provides it, otherwise the debug key
            signingConfig(['ANDROID_UPLOAD_KEYSTORE', 'ANDROID_UPLOAD_KEYSTORE_PASSWORD', 'ANDROID_UPLOAD_KEY_ALIAS', 'ANDROID_UPLOAD_KEY_PASSWORD'].every { System.getenv(it) } ? signingConfigs.release : signingConfigs.debug)`;

/** app/build.gradle に、Release の署名の設定を入れる（入れてあれば、何もしない） */
function applyReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  // 1. signingConfigs に release を足す（debug の閉じ括弧のあと）
  const debugConfig = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
  if (!debugConfig.test(gradle)) throw new Error('withAndroidReleaseSigning: signingConfigs.debug が見つかりません（Expo のひな形が変わった）');
  let next = gradle.replace(debugConfig, `$1${SIGNING_CONFIG}`);
  // 2. buildTypes.release の signingConfig を差し替える
  const releaseSigning = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseSigning.test(next)) throw new Error('withAndroidReleaseSigning: buildTypes.release の signingConfig が見つかりません（Expo のひな形が変わった）');
  next = next.replace(releaseSigning, `$1${RELEASE_SIGNING}`);
  return next;
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('withAndroidReleaseSigning: app/build.gradle が groovy ではありません');
    cfg.modResults.contents = applyReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;
