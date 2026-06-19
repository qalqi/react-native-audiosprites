const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

module.exports = function (api) {
  const hasCaller = api.caller((caller) => !!caller);
  api.cache.using(() => hasCaller);

  if (!hasCaller) {
    return {
      presets: ['babel-preset-expo'],
    };
  }

  return getConfig(
    {
      presets: ['babel-preset-expo'],
    },
    { root, pkg }
  );
};

