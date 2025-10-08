module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'react-app', // Extends Create React App's recommended configuration
    'react-app/jest', // Extends Create React App's Jest configuration
    'plugin:prettier/recommended', // Integrates Prettier
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    'react/react-in-jsx-scope': 'off', // Not needed for React 17+ with new JSX transform
    'react/prop-types': 'off', // Disable prop-types validation if using TypeScript or not strictly enforcing
    'no-unused-vars': ['warn', { args: 'none' }], // Warn about unused variables, ignore args
  },
  settings: {
    react: {
      version: 'detect', // Automatically detect the React version
    },
  },
};