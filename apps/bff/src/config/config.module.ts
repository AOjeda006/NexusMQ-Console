import { Global, Module } from '@nestjs/common';

import { ConfigService } from './config.service';

/**
 * Módulo de configuración, **global**: `ConfigService` queda inyectable en todo
 * el árbol sin re-importar el módulo en cada feature.
 */
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
