import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { fetch } from 'undici';

import { ConfigService } from '../config/config.service';
import { buildHistoryQuery } from './history-metrics';
import type { QueryRangeParams } from './prometheus.schemas';

/**
 * Respuesta de historia hacia el navegador. `available: false` **no es un
 * error**: es la degradación limpia cuando no hay Prometheus configurado, para
 * que la SPA oculte las vistas de historia sin romperse.
 */
export type HistoryResponse =
  | { readonly available: true; readonly resultType: string; readonly result: readonly unknown[] }
  | { readonly available: false; readonly reason: string };

interface PromSuccess {
  readonly status: 'success';
  readonly data: { readonly resultType: string; readonly result: readonly unknown[] };
}
interface PromError {
  readonly status: 'error';
  readonly errorType?: string;
  readonly error?: string;
}
type PromPayload = PromSuccess | PromError;

function promErrorDetail(payload: PromPayload | undefined): string | undefined {
  return payload?.status === 'error' ? payload.error : undefined;
}

/**
 * Data source de Prometheus para las vistas de historia (series temporales).
 * Proxya `query_range` con **degradación limpia**: sin `PROMETHEUS_URL` responde
 * "no disponible" (200) en vez de fallar; con Prometheus configurado, propaga
 * las consultas inválidas como 400 y los fallos de red/servidor como 502.
 */
@Injectable()
export class PrometheusService {
  private readonly logger = new Logger(PrometheusService.name);

  constructor(private readonly config: ConfigService) {}

  /** ¿Hay un Prometheus configurado? Si no, la historia degrada limpio. */
  get isConfigured(): boolean {
    return this.config.isPrometheusConfigured;
  }

  /** Ejecuta un `query_range`; degrada a "no disponible" si no hay Prometheus. */
  async queryRange(params: QueryRangeParams): Promise<HistoryResponse> {
    const base = this.config.prometheusUrl;
    if (base === undefined) {
      return { available: false, reason: 'Prometheus no está configurado en el BFF.' };
    }

    // La PromQL se **construye en servidor** desde el id de la allow-list; nunca
    // llega cruda del cliente (F5.6).
    const query = buildHistoryQuery(params.metric, params.window);
    const url = new URL(`${base.replace(/\/+$/, '')}/api/v1/query_range`);
    url.searchParams.set('query', query);
    url.searchParams.set('start', params.start);
    url.searchParams.set('end', params.end);
    url.searchParams.set('step', params.step);

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
    } catch (cause) {
      this.logger.warn(`Fallo al contactar con Prometheus: ${String(cause)}`);
      throw new BadGatewayException({
        title: 'Prometheus inaccesible',
        detail: 'El BFF no pudo contactar con Prometheus.',
      });
    }

    const payload = (await response.json().catch(() => undefined)) as PromPayload | undefined;

    if (response.status >= 500) {
      throw new BadGatewayException({
        title: 'Prometheus falló',
        detail: promErrorDetail(payload),
      });
    }
    if (!response.ok || payload?.status !== 'success') {
      throw new BadRequestException({
        title: 'Consulta a Prometheus inválida',
        detail: promErrorDetail(payload),
      });
    }

    return { available: true, resultType: payload.data.resultType, result: payload.data.result };
  }
}
