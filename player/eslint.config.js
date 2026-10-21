import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(
  globalIgnores(['dist', 'coverage']),
  {
    extends: [js.configs.recommended, tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Player core boundary (ADR 0029, spec 0006 A2): plain TypeScript, with the
    // browser and the UI injected as parameters.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'The player core does not import React (ADR 0029).' },
            { name: 'react-dom', message: 'The player core does not import React (ADR 0029).' },
            {
              name: 'i18next',
              message: 'The player core receives translated texts as parameters (ADR 0029).',
            },
            {
              name: 'react-i18next',
              message: 'The player core receives translated texts as parameters (ADR 0029).',
            },
            {
              name: 'src/config/i18n',
              message: 'The player core receives translated texts as parameters (ADR 0029).',
            },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*'],
              message: 'The player core does not import React (ADR 0029).',
            },
            {
              group: ['@mui/*', '@emotion/*'],
              message: 'The player core does not import MUI or Emotion (ADR 0029).',
            },
            {
              group: ['src/hooks/*', 'src/components/*'],
              message:
                'The player core does not depend on hooks or components; they depend on it (ADR 0029).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Inject what the core needs from window as a parameter (ADR 0029).',
        },
        {
          name: 'document',
          message: 'Inject what the core needs from document as a parameter (ADR 0029).',
        },
        {
          name: 'navigator',
          message: 'Inject what the core needs from navigator as a parameter (ADR 0029).',
        },
        { name: 'localStorage', message: 'Inject storage as a parameter (ADR 0029).' },
      ],
    },
  },
)
