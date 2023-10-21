import globals from 'globals';
import config from 'eslint-config-qubyte';

export default [
  {
    ignores: ['*.cjs']
  },
  {
    languageOptions: {
      ...config.languageOptions,
      globals: globals.browser
    },
    rules: {
      ...config.rules,
      'no-bitwise': 'off',
      complexity: 'off'
    }
  }
];
