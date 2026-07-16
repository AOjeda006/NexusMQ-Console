import { Injectable } from '@nestjs/common';

/**
 * Configuración del BFF derivada del entorno.
 *
 * @remarks
 * En F1.1 expone lo mínimo para arrancar y hacer de proxy. En **F1.2** este
 * servicio pasa a validar el entorno *fail-fast* con zod (allow-list:
 * `PROMETHEUS_URL`, secreto de sesión, TLS/`NODE_EXTRA_CA_CERTS`, …) y a abortar
 * el arranque ante un env inválido.
 */
@Injectable()
export class ConfigService {
  /** Puerto en el que escucha el BFF. */
  readonly port: number;

  /** URL base del plano de operación (admin) del broker NexusMQ. */
  readonly brokerAdminUrl: string;

  constructor() {
    this.port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
    this.brokerAdminUrl = process.env['BROKER_ADMIN_URL'] ?? 'http://localhost:9644';
  }
}
