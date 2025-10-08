module.exports = {
  displayName: 'frontend',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/client/src/**/*.test.js',
    '<rootDir>/client/src/**/*.test.jsx',
  ],
  setupFiles: ['<rootDir>/client/src/setupPolyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.js'],
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)'
  ],
  moduleNameMapper: {
    '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  coverageDirectory: 'coverage/frontend',
  // Skip failing setup files if they don't exist
  modulePathIgnorePatterns: [
    '<rootDir>/client/src/setupPolyfills.js',
    '<rootDir>/client/src/setupTests.js'
  ].filter(path => {
    const fs = require('fs');
    return !fs.existsSync(path.replace('<rootDir>', process.cwd()));
  })
};