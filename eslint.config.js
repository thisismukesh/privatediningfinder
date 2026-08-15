import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**'],
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'packages/domain/**' },
        { type: 'db', pattern: 'packages/db/**' },
        { type: 'providers', pattern: 'packages/providers/**' },
        { type: 'pipeline', pattern: 'packages/pipeline/**' },
        { type: 'evals', pattern: 'packages/evals/**' },
        { type: 'web', pattern: 'apps/web/**' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'domain',
              disallow: ['db', 'providers', 'pipeline', 'evals', 'web'],
              message: 'packages/domain is pure and may not depend on any IO-performing package.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'packages/domain must not perform IO.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'packages/domain must not read the system clock. Inject `now` instead.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'packages/domain must not read the system clock. Inject `now` instead.',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'packages/domain must not use Math.random(). Inject a random source instead.',
        },
      ],
    },
  },
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fs', message: 'packages/domain must not perform IO.' },
            { name: 'node:fs', message: 'packages/domain must not perform IO.' },
            { name: 'http', message: 'packages/domain must not perform IO.' },
            { name: 'https', message: 'packages/domain must not perform IO.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
