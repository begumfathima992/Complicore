module.exports = {
  testEnvironment: 'node',
  watchman: false,
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  testTimeout: 20000,
  testPathIgnorePatterns: ['/node_modules/', '/frontend/'],
};
