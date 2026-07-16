// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Configuración ESLint (flat) compartida por todo el monorepo.
 *
 * Base: `js.recommended` + `typescript-eslint` (recommended + stylistic) y, al
 * final, `eslint-config-prettier` para desactivar las reglas de formato que
 * gestiona Prettier. Cada paquete puede extender esta base en su propia fase
 * (React en `apps/web`, NestJS en `apps/bff`).
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'packages/contract/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Scripts de tooling y ficheros de config en JS plano: entorno Node.
    files: ['**/*.{js,cjs,mjs}', '**/scripts/**/*.{ts,mts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
