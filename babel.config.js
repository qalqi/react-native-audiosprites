module.exports = function (api) {
  const hasCaller = api.caller((caller) => !!caller);
  api.cache.using(() => hasCaller);

  if (!hasCaller) {
    return {};
  }

  return {
    overrides: [
      {
        exclude: /\/node_modules\//,
        presets: ['module:react-native-builder-bob/babel-preset'],
      },
      {
        include: /\/node_modules\//,
        presets: ['module:@react-native/babel-preset'],
      },
    ],
  };
};

