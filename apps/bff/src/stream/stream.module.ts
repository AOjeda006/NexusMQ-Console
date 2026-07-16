import { Module } from '@nestjs/common';

import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';

/**
 * Módulo de terminación SSE (F1.5). `BrokerService` llega vía `BrokerModule`
 * (`@Global()`), así que no hace falta importarlo explícitamente.
 */
@Module({
  controllers: [StreamController],
  providers: [StreamService],
  exports: [StreamService],
})
export class StreamModule {}
