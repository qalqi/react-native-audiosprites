const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// 1. Get the baseline config straight from Expo
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 2. Add monorepo tracking directories
config.watchFolders = [workspaceRoot];

// 3. Force Metro to resolve node_modules up and down the monorepo tree safely
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;