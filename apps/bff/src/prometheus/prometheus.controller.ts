import { Controller, Get, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type HistoryResponse, PrometheusService } from './prometheus.service';
import { type QueryRangeParams, queryRangeSchema } from './prometheus.schemas';

/** ¿Están disponibles las vistas de historia? (para que la SPA las muestre o no). */
interface HistoryAvailability {
  readonly available: boolean;
}

/**
 * Vistas de **historia** (series temporales de Prometheus). Ruta abierta, como
 * el resto de la observabilidad. Devuelve datos o una señal de "no disponible"
 * (nunca rompe por ausencia de Prometheus); las consultas inválidas o los
 * fallos de Prometheus sí se señalizan como error (400/502).
 */
@Controller('api/history')
export class PrometheusController {
  constructor(private readonly prometheus: PrometheusService) {}

  @Get('status')
  status(): HistoryAvailability {
    return { available: this.prometheus.isConfigured };
  }

  @Get('query_range')
  async queryRange(
    @Query(new ZodValidationPipe(queryRangeSchema)) params: QueryRangeParams,
  ): Promise<HistoryResponse> {
    return this.prometheus.queryRange(params);
  }
}
