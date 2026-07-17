import { Controller, Get, Query } from '@nestjs/common';

import { Protected } from '../auth/protected.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type HistoryResponse, PrometheusService } from './prometheus.service';
import { type QueryRangeParams, queryRangeSchema } from './prometheus.schemas';

/** ¿Están disponibles las vistas de historia? (para que la SPA las muestre o no). */
interface HistoryAvailability {
  readonly available: boolean;
}

/**
 * Vistas de **historia** (series temporales de Prometheus). `status` es abierto
 * (solo informa disponibilidad); `query_range` es **`@Protected`** (exige sesión)
 * y **no** acepta PromQL cruda: el cliente elige un id de la allow-list y el BFF
 * construye la PromQL en servidor (F5.6). Devuelve datos o "no disponible" (nunca
 * rompe por ausencia de Prometheus); consulta inválida/allow-list → 400, fallo de
 * Prometheus → 502.
 */
@Controller('api/history')
export class PrometheusController {
  constructor(private readonly prometheus: PrometheusService) {}

  @Get('status')
  status(): HistoryAvailability {
    return { available: this.prometheus.isConfigured };
  }

  @Protected()
  @Get('query_range')
  async queryRange(
    @Query(new ZodValidationPipe(queryRangeSchema)) params: QueryRangeParams,
  ): Promise<HistoryResponse> {
    return this.prometheus.queryRange(params);
  }
}
