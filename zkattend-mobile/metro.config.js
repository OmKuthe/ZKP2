// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add custom asset extensions
config.resolver.assetExts.push('wasm', 'zkey');

module.exports = config;
