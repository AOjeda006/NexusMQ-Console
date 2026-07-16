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

void bootstrap();
