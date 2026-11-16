// Learn more https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// amazon-cognito-identity-js の乱数の取り方を、expo-crypto を使う版に差し替える。
// 理由は src/shims/cognitoGetRandomValues.ts に書いた。
const cognitoDir = `${path.sep}amazon-cognito-identity-js${path.sep}`;
const randomShim = path.resolve(__dirname, 'src/shims/cognitoGetRandomValues.ts');
const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === './getRandomValues' && context.originModulePath.includes(cognitoDir)) {
    return { type: 'sourceFile', filePath: randomShim };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
