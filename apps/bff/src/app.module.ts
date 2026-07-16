import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { BrokerModule } from './broker/broker.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrometheusModule } from './prometheus/prometheus.module';
import { StreamModule } from './stream/stream.module';

/**
 * Módulo raíz del BFF. Compone los módulos de features siguiendo la separación
 * de responsabilidades: `config` (transversal, global), `health`, `broker`
 * (proxy REST), `prometheus` (data source), `auth` (JWT confinado) y `stream`
 * (terminación SSE). Cada uno se desarrolla en su ítem de la Fase 1.
 */
@Module({
  imports: [ConfigModule, HealthModule, BrokerModule, PrometheusModule, AuthModule, StreamModule],
})
export class AppModule {}
