import { Injectable } from '@nestjs/common';

import { validateEnv } from './config.schema';

/**
 * Configuración del BFF derivada del entorno, **validada *fail-fast*** en el
 * arranque (ver {@link validateEnv}). Si el entorno es inválido, la construcción
 * de este provider lanza y NestJS aborta el bootstrap con un mensaje claro.
 */
@Injectable()
export class ConfigService {
  /** Puerto en el que escucha el BFF. */
  readonly port: number;

  /** URL base del plano de operación (admin) del broker NexusMQ. */
  readonly brokerAdminUrl: string;

  /** URL de Prometheus (opcional); `undefined` ⇒ vistas de historia degradadas. */
  readonly prometheusUrl: string | undefined;

  /** Secreto para firmar la cookie de sesión httpOnly del BFF. */
  readonly sessionSecret: string;

  /** ¿Validar el certificado TLS del broker al hacer de proxy? */
  readonly brokerTlsRejectUnauthorized: boolean;

  constructor() {
    const config = validateEnv(process.env);
    this.port = config.port;
    this.brokerAdminUrl = config.brokerAdminUrl;
    this.prometheusUrl = config.prometheusUrl;
    this.sessionSecret = config.sessionSecret;
    this.brokerTlsRejectUnauthorized = config.brokerTlsRejectUnauthorized;
  }

  /** ¿Hay un Prometheus configurado? Guía la degradación limpia (F1.6). */
  get isPrometheusConfigured(): boolean {
    return this.prometheusUrl !== undefined;
  }
}
