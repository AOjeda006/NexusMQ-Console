import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Config de Vitest de la SPA. Los directorios `e2e/` y `e2e-fullstack/` contienen
 * specs de **Playwright** (`@playwright/test`), no de Vitest; se excluyen para que
 * `vitest run` no intente ejecutarlos. Las pruebas unitarias/componentes de Vitest
 * (cuando las haya) viven junto al código en `src/`.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', 'e2e-fullstack/**'],
  },
});
