import { Injectable, Logger } from '@nestjs/common';
import { Agent, type Dispatcher, fetch } from 'undici';

import type { paths } from '@nexusmq/contract';

import { ConfigService } from '../config/config.service';

/**
 * Snapshot de métricas del broker, tipado **desde el contrato generado**
 * (`packages/contract`). Nunca se escribe a mano: si cambia el OpenAPI de
 * NexusMQ, este tipo cambia con `sync:openapi` + `generate`.
 */
export type MetricsSnapshot =
  paths['/api/v1/metrics/snapshot']['get']['responses']['200']['content']['application/json'];

/** Métodos HTTP admitidos al hacer de proxy hacia el broker. */
export type ProxyMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Petición a reenviar al plano de operación (admin) del broker. */
export interface ForwardOptions {
  readonly method: ProxyMethod;
  readonly path: string;
  readonly query?: Record<string, string | number | undefined>;
  readonly body?: unknown;
  /** JWT del broker (F1.4). En F1.3 aún no se inyecta ninguno. */
  readonly token?: string;
}

/** Respuesta del broker capturada para reemitirla *verbatim* al navegador. */
export interface ProxyResult {
  readonly status: number;
  readonly contentType: string | undefined;
  readonly body: string;
  readonly location: string | undefined;
}

/**
 * El broker no respondió (red caída, DNS, TLS, timeout). Es un fallo del BFF
 * como cliente, no un error de negocio del broker: el `ProblemDetailsFilter` lo
 * traduce a `502 Bad Gateway` en `application/problem+json`.
 */
export class BrokerUnreachableError extends Error {
  constructor(cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`No se pudo contactar con el broker NexusMQ: ${reason}`);
    this.name = 'BrokerUnreachableError';
  }
}

/**
 * Cliente del plano de operación (admin) del broker. Implementa el proxy REST
 * *passthrough*: reenvía la petición con `fetch` (undici) y captura la respuesta
 * tal cual —status, `Content-Type` y cuerpo— para que el controller la reemita
 * sin interpretarla. Los errores del broker (RFC 7807) viajan intactos; solo la
 * imposibilidad de contactar se convierte en {@link BrokerUnreachableError}.
 */
@Injectable()
export class BrokerService {
  private readonly logger = new Logger(BrokerService.name);

  /**
   * Dispatcher propio solo cuando hay que **relajar** la verificación TLS del
   * broker (`BROKER_TLS_REJECT_UNAUTHORIZED=false`). En el caso estricto (por
   * defecto) se usa el dispatcher global de undici.
   */
  private readonly dispatcher: Dispatcher | undefined;

  constructor(private readonly config: ConfigService) {
    this.dispatcher = config.brokerTlsRejectUnauthorized
      ? undefined
      : new Agent({ connect: { rejectUnauthorized: false } });
  }

  /** URL base del broker a la que apuntan las peticiones proxied. */
  get targetBaseUrl(): string {
    return this.config.brokerAdminUrl;
  }

  /** Reenvía una petición al broker y captura su respuesta para reemitirla. */
  async forward(options: ForwardOptions): Promise<ProxyResult> {
    const url = this.buildUrl(options.path, options.query);
    const hasBody = options.body !== undefined;

    const headers: Record<string, string> = {
      accept: 'application/json, application/problem+json',
    };
    if (hasBody) {
      headers['content-type'] = 'application/json';
    }
    if (options.token !== undefined) {
      headers['authorization'] = `Bearer ${options.token}`;
    }

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(url, {
        method: options.method,
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined,
        dispatcher: this.dispatcher,
      });
    } catch (cause) {
      this.logger.warn(`Fallo al contactar con el broker (${options.method} ${options.path}).`);
      throw new BrokerUnreachableError(cause);
    }

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? undefined,
      body: await response.text(),
      location: response.headers.get('location') ?? undefined,
    };
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const base = this.config.brokerAdminUrl.replace(/\/+$/, '');
    const url = new URL(`${base}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}
