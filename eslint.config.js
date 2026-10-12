// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*'],
  },
  {
    rules: {
      // Zod schemas and their inferred types intentionally share a name; TypeScript itself
      // reports real redeclarations.
      '@typescript-eslint/no-redeclare': 'off',
    },
  },
]);
