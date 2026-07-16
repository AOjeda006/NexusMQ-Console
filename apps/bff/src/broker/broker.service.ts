import { Injectable } from '@nestjs/common';

import type { paths } from '@nexusmq/contract';

import { ConfigService } from '../config/config.service';

/**
 * Snapshot de métricas del broker, tipado **desde el contrato generado**
 * (`packages/contract`). Nunca se escribe a mano: si cambia el OpenAPI de
 * NexusMQ, este tipo cambia con `sync:openapi` + `generate`.
 */
export type MetricsSnapshot =
  paths['/api/v1/metrics/snapshot']['get']['responses']['200']['content']['application/json'];

/**
 * Cliente del plano de operación (admin) del broker. En **F1.3** implementa el
 * proxy REST *passthrough* (topics, groups, cluster, metrics, health) con
 * `fetch` nativo y reemisión de errores RFC 7807. Aquí queda el esqueleto con la
 * DI de configuración resuelta.
 */
@Injectable()
export class BrokerService {
  constructor(private readonly config: ConfigService) {}

  /** URL base del broker a la que apuntarán las peticiones proxied (F1.3). */
  get targetBaseUrl(): string {
    return this.config.brokerAdminUrl;
  }
}
