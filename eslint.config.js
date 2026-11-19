// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // ページに入れるスクリプトは、テンプレート文字列（`...`）の中に書いてある。そこで \s のように \ を1つだけ書くと、
    // できあがったスクリプトでは「s」になり、正規表現が黙って別のものになる（\\s と書く）。それを見つける
    files: ['src/webview/**/*.ts'],
    rules: { 'no-useless-escape': 'error' },
  },
]);
