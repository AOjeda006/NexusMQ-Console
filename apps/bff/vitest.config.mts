import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Config de Vitest del BFF. NestJS resuelve la DI leyendo la metadata de
 * decoradores (`design:paramtypes`), que esbuild —el transformador por defecto
 * de Vitest— no emite. Usamos `unplugin-swc` para transformar los `.ts` con SWC
 * y conservar esa metadata (toma `experimentalDecorators`/`emitDecoratorMetadata`
 * del `tsconfig.json`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Config *fail-fast*: los tests que arrancan la app necesitan un entorno
    // válido antes de instanciar el `ConfigService`.
    setupFiles: ['./test/setup-env.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
