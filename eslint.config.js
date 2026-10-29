import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // El motor es puro y determinista: no conoce la UI, ni las animaciones, ni el DOM.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react-dom/*', 'gsap', 'gsap/*'],
              message:
                'El motor debe ser puro: no puede depender de React ni de GSAP (ver CLAUDE.md, regla 1).',
            },
            {
              group: ['**/ui/**', '**/anim/**', '../ui/*', '../anim/*'],
              message:
                'engine/ no puede importar de ui/ ni de anim/ (ver CLAUDE.md, regla 1).',
            },
          ],
        },
      ],
    },
  },

  // Componentes React.
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
