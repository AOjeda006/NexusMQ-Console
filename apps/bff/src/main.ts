import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

/**
 * Punto de entrada del BFF. Levanta la app Nest, habilita el apagado ordenado
 * (cierra conexiones salientes y streams SSE en `SIGTERM`/`SIGINT`) y escucha en
 * el puerto configurado.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  await app.listen(config.port);

  Logger.log(`BFF escuchando en http://localhost:${config.port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // Fail-fast: config de entorno inválida u otro fallo de arranque. Mensaje
  // claro y salida con código de error para que orquestadores/CI lo detecten.
  const message = error instanceof Error ? error.message : String(error);
  Logger.error(message, undefined, 'Bootstrap');
  process.exit(1);
});
