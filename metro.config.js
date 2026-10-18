// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite compiled to WebAssembly and needs SharedArrayBuffer, which
// browsers only allow on cross-origin isolated pages.
config.resolver.assetExts.push('wasm');
// The website's fonts are WOFF2 subsets (src/ui/theme/fontFiles.web.ts).
config.resolver.assetExts.push('woff2');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
