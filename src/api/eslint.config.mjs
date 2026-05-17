import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'prisma/**', 'scripts/**', '**/__tests__/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parser: tseslint.parser,
      parserOptions: {
        project: false,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
];
