import { Injectable } from '@nestjs/common';

import { validateEnv } from './config.schema';

/**
 * Configuración del BFF derivada del entorno, **validada *fail-fast*** en el
 * arranque (ver {@link validateEnv}). Si el entorno es inválido, la construcción
 * de este provider lanza y NestJS aborta el bootstrap con un mensaje claro.
 */
@Injectable()
export class ConfigService {
  /** Entorno de ejecución (`development` | `test` | `production`). */
  readonly nodeEnv: 'development' | 'test' | 'production';

  /** Puerto en el que escucha el BFF. */
  readonly port: number;

  /** URL base del plano de operación (admin) del broker NexusMQ. */
  readonly brokerAdminUrl: string;

  /** URL de Prometheus (opcional); `undefined` ⇒ vistas de historia degradadas. */
  readonly prometheusUrl: string | undefined;

  /** Secreto para firmar la cookie de sesión httpOnly del BFF. */
  readonly sessionSecret: string;

  /** TTL de una sesión de operador en milisegundos (caduca y se purga en servidor). */
  readonly sessionTtlMs: number;

  /** ¿Validar el certificado TLS del broker al hacer de proxy? */
  readonly brokerTlsRejectUnauthorized: boolean;

  /** Gate de login: si `true`, las rutas protegidas exigen sesión aunque el broker esté abierto. */
  readonly consoleRequireLogin: boolean;

  /** Directorio del build estático de la SPA a servir en `/` (F1.7). */
  readonly webDistPath: string | undefined;

  constructor() {
    const config = validateEnv(process.env);
    this.nodeEnv = config.nodeEnv;
    this.port = config.port;
    this.brokerAdminUrl = config.brokerAdminUrl;
    this.prometheusUrl = config.prometheusUrl;
    this.sessionSecret = config.sessionSecret;
    this.sessionTtlMs = config.sessionTtlMs;
    this.brokerTlsRejectUnauthorized = config.brokerTlsRejectUnauthorized;
    this.consoleRequireLogin = config.consoleRequireLogin;
    this.webDistPath = config.webDistPath;
  }

  /** ¿Hay un Prometheus configurado? Guía la degradación limpia (F1.6). */
  get isPrometheusConfigured(): boolean {
    return this.prometheusUrl !== undefined;
  }

  /** ¿Entorno de producción? (cookie `Secure`, servido de la SPA por defecto). */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
