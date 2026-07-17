/**
 * **Allow-list de métricas de historia.** El `query_range` no acepta PromQL cruda
 * del cliente (sería un motor PromQL abierto: superficie de SSRF/DoS contra
 * Prometheus). El cliente solo elige un **id de métrica** de esta lista y el BFF
 * **construye** la PromQL aquí, en servidor, contra los nombres REALES del broker.
 *
 * Fuente de verdad de los nombres: `docs/metrics.md` del broker (repo hermano
 * `../NexusMQ`). Familias del plano de datos `nexus_broker_*` con `{api,protocol}`.
 * Si el broker cambia el catálogo, corre `sync:openapi` y refleja el cambio aquí.
 *
 * @see ../../../../../NexusMQ/docs/metrics.md — catálogo de métricas del broker.
 */

/** Ids de métrica de historia permitidos (allow-list cerrada). */
export const HISTORY_METRIC_IDS = [
  'throughput-produce',
  'throughput-fetch',
  'latency-p50',
  'latency-p99',
  'latency-p999',
  'errors',
  'bytes-produce',
  'bytes-fetch',
  'messages-produce',
  'messages-fetch',
] as const;

export type HistoryMetricId = (typeof HISTORY_METRIC_IDS)[number];

/** Throughput/bytes/mensajes por `api`: `sum(rate(<counter>{api="…"}[w]))`. */
function counterRateByApi(counter: string, api: string, window: string): string {
  return `sum(rate(${counter}{api="${api}"}[${window}]))`;
}

/** Cuantil de latencia de `produce`: `histogram_quantile(q, sum(rate(bucket{api}[w])) by (le))`. */
function latencyQuantile(quantile: number, window: string): string {
  return `histogram_quantile(${quantile}, sum(rate(nexus_broker_request_duration_seconds_bucket{api="produce"}[${window}])) by (le))`;
}

/** Constructores de PromQL por id, parametrizados solo por la ventana `rate()`. */
const BUILDERS: Record<HistoryMetricId, (window: string) => string> = {
  'throughput-produce': (w) => counterRateByApi('nexus_broker_requests_total', 'produce', w),
  'throughput-fetch': (w) => counterRateByApi('nexus_broker_requests_total', 'fetch', w),
  'latency-p50': (w) => latencyQuantile(0.5, w),
  'latency-p99': (w) => latencyQuantile(0.99, w),
  'latency-p999': (w) => latencyQuantile(0.999, w),
  errors: (w) => `sum(rate(nexus_broker_request_errors_total[${w}]))`,
  'bytes-produce': (w) => counterRateByApi('nexus_broker_request_bytes_total', 'produce', w),
  'bytes-fetch': (w) => counterRateByApi('nexus_broker_request_bytes_total', 'fetch', w),
  'messages-produce': (w) => counterRateByApi('nexus_broker_messages_total', 'produce', w),
  'messages-fetch': (w) => counterRateByApi('nexus_broker_messages_total', 'fetch', w),
};

/** ¿Es `value` un id de métrica de historia permitido? */
export function isHistoryMetricId(value: string): value is HistoryMetricId {
  return (HISTORY_METRIC_IDS as readonly string[]).includes(value);
}

/**
 * Construye la PromQL del id de métrica con la ventana `rate()` dada. El id ya
 * viene validado (enum del esquema); `window` es una duración Prometheus validada
 * en el borde, nunca PromQL cruda.
 */
export function buildHistoryQuery(metric: HistoryMetricId, window: string): string {
  return BUILDERS[metric](window);
}
