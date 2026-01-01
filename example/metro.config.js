const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');
const {
  wrapWithAudioAPIMetroConfig,
} = require('react-native-audio-api/metro-config');
const root = path.resolve(__dirname, '..');

const { withMetroConfig } = require('./metro-monorepo-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
});

config.resolver.unstable_enablePackageExports = true;

module.exports = wrapWithAudioAPIMetroConfig(config);
