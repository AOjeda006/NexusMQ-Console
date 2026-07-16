import { Injectable } from '@nestjs/common';

import { ConfigService } from '../config/config.service';

/**
 * Data source de Prometheus para las vistas de historia (series temporales).
 *
 * @remarks
 * En **F1.6** implementa el proxy de `query_range` con **degradación limpia**:
 * si no hay `PROMETHEUS_URL` configurada, responde "no disponible" sin romper.
 * Aquí ya deriva su disponibilidad de la config validada.
 */
@Injectable()
export class PrometheusService {
  constructor(private readonly config: ConfigService) {}

  /** ¿Hay un Prometheus configurado? Si no, la historia degrada (F1.6). */
  get isConfigured(): boolean {
    return this.config.isPrometheusConfigured;
  }
}
