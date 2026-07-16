import { Injectable } from '@nestjs/common';

/**
 * Data source de Prometheus para las vistas de historia (series temporales).
 *
 * @remarks
 * En **F1.6** implementa el proxy de `query_range` con **degradación limpia**:
 * si no hay `PROMETHEUS_URL` configurada, responde "no disponible" sin romper.
 * De momento reporta que aún no está configurado.
 */
@Injectable()
export class PrometheusService {
  /** ¿Hay un Prometheus configurado? En F1.6 dependerá de `PROMETHEUS_URL`. */
  readonly isConfigured: boolean = false;
}
