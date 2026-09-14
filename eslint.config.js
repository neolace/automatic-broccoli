import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Repository-wide ESLint flat configuration.
 *
 * Prettier owns formatting (see prettier.config.mjs), so formatting rules are
 * disabled here via eslint-config-prettier. ESLint owns code-quality and
 * framework rules only.
 */
export default defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cdk.out/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // Shared TypeScript rules for every workspace.
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  // Browser application (React).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...react.configs.flat['jsx-runtime'],
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react/prop-types': 'off',
    },
  },
  {
    // Vite / Playwright config files run under Node.
    files: ['apps/web/*.ts', 'apps/web/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Node workloads: CDK infrastructure, shared package, scripts.
  // The Lambda API is implemented in C# (apps/api) and is linted separately
  // via `dotnet format` -- see package.json's format:api / format:check:api.
  {
    files: ['infra/**/*.ts', 'packages/**/*.ts', 'scripts/**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'infra/bin/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  prettier,
]);
