module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true, // Enable Jest global variables
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    'no-unused-vars': ['warn', { args: 'none' }], // Warn about unused variables, ignore args
  },
};
