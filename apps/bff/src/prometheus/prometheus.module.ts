import { Module } from '@nestjs/common';

import { PrometheusController } from './prometheus.controller';
import { PrometheusService } from './prometheus.service';

/** Módulo del data source de Prometheus (F1.6): vistas de historia con degradación limpia. */
@Module({
  controllers: [PrometheusController],
  providers: [PrometheusService],
  exports: [PrometheusService],
})
export class PrometheusModule {}
