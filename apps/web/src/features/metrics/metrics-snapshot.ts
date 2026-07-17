import type { components } from '@nexusmq/contract';

/**
 * Snapshot estructurado de métricas del broker (`GET /api/v1/metrics/snapshot` y
 * el evento `metrics` del SSE comparten esta forma). Sale del contrato generado;
 * **no se escribe a mano**.
 */
export type MetricsSnapshot = components['schemas']['MetricsSnapshot'];
export type MetricSample = components['schemas']['MetricSample'];

/** Histograma normalizado: total (`count`, cubo +Inf), `sum` y cubos finitos acumulativos. */
export interface HistogramView {
  readonly count: number;
  readonly sum: number;
  readonly buckets: readonly { readonly le: number; readonly cumulativeCount: number }[];
}

/**
 * Selector de etiquetas: subconjunto `{clave: valor}` que una serie debe cumplir
 * (todas las claves del selector deben coincidir con las de la muestra). Un
 * selector vacío/ausente casa con cualquier serie. Es el equivalente al
 * `{api="produce"}` de PromQL: el `MetricsSnapshot` es una lista **abierta** de
 * series con `labels`, y el broker desglosa cada familia por `{api,protocol}` (o
 * `{plane}`), así que hay que **filtrar por label**, no sumar/elegir a ciegas.
 */
export type LabelSelector = Readonly<Record<string, string>>;

/**
 * Nombres de métrica REALES del broker que consume el Dashboard. Fuente de verdad
 * de los nombres: `docs/metrics.md` del broker (repo hermano `../NexusMQ`); el
 * OpenAPI fija la **forma** del snapshot (lista abierta de `MetricSample`), no los
 * nombres. Todas las familias del plano de datos llevan las etiquetas
 * `{api: produce|fetch, protocol: native|kafka}`; `connections_active` lleva
 * `{plane: native|kafka|admin}`. Se **degrada con honestidad** (muestra «—») si
 * una serie no está presente (p. ej. `messages_total`/`connections_active` hasta
 * que el broker las emita).
 *
 * @see ../../../../../NexusMQ/docs/metrics.md — catálogo de métricas del broker.
 */
export const METRIC = {
  /** counter — peticiones del plano de datos servidas, por `{api,protocol}`. */
  requests: 'nexus_broker_requests_total',
  /** counter — peticiones con error de wire, por `{api,protocol}`. */
  requestErrors: 'nexus_broker_request_errors_total',
  /** counter — bytes de payload del plano de datos, por `{api,protocol}`. */
  requestBytes: 'nexus_broker_request_bytes_total',
  /** counter — records (mensajes) del plano de datos, por `{api,protocol}`. */
  messages: 'nexus_broker_messages_total',
  /** histogram — latencia de servicio (segundos), por `{api,protocol}`. */
  requestDuration: 'nexus_broker_request_duration_seconds',
  /** gauge — conexiones de cliente activas, por `{plane}`. */
  connections: 'nexus_broker_connections_active',
} as const;

/** Valores de la etiqueta `api` del plano de datos. */
export const API = { produce: 'produce', fetch: 'fetch' } as const;

/** ¿La muestra cumple el selector de etiquetas? (todas las claves deben coincidir). */
function matchesSelector(sample: MetricSample, selector: LabelSelector | undefined): boolean {
  if (selector === undefined) {
    return true;
  }
  for (const key of Object.keys(selector)) {
    if (sample.labels[key] !== selector[key]) {
      return false;
    }
  }
  return true;
}

/** Suma el `value` de las series `counter` con ese nombre que casen el selector (o `null`). */
export function findCounter(
  snapshot: MetricsSnapshot,
  name: string,
  selector?: LabelSelector,
): number | null {
  return sumValues(snapshot, name, 'counter', selector);
}

/** Suma el `value` de las series `gauge` con ese nombre que casen el selector (o `null`). */
export function findGauge(
  snapshot: MetricsSnapshot,
  name: string,
  selector?: LabelSelector,
): number | null {
  return sumValues(snapshot, name, 'gauge', selector);
}

function sumValues(
  snapshot: MetricsSnapshot,
  name: string,
  type: MetricSample['type'],
  selector: LabelSelector | undefined,
): number | null {
  let total = 0;
  let found = false;
  for (const sample of snapshot.metrics) {
    if (
      sample.name === name &&
      sample.type === type &&
      matchesSelector(sample, selector) &&
      typeof sample.value === 'number'
    ) {
      total += sample.value;
      found = true;
    }
  }
  return found ? total : null;
}

/**
 * Histograma **agregado** de todas las series con ese nombre que casen el selector
 * (p. ej. `produce` sobre los protocolos `native`+`kafka`), normalizado a
 * {@link HistogramView} con los cubos sumados por `le` y ordenados ascendente. Es
 * el equivalente cliente de `sum(...) by (le)`: sumar cubos acumulativos serie a
 * serie da la distribución acumulada agregada. `null` si no hay ninguna serie.
 */
export function findHistogram(
  snapshot: MetricsSnapshot,
  name: string,
  selector?: LabelSelector,
): HistogramView | null {
  const cumulativeByLe = new Map<number, number>();
  let count = 0;
  let sum = 0;
  let found = false;
  for (const sample of snapshot.metrics) {
    if (
      sample.name === name &&
      sample.type === 'histogram' &&
      sample.buckets !== undefined &&
      matchesSelector(sample, selector)
    ) {
      found = true;
      count += sample.count ?? 0;
      sum += sample.sum ?? 0;
      for (const bucket of sample.buckets) {
        cumulativeByLe.set(bucket.le, (cumulativeByLe.get(bucket.le) ?? 0) + bucket.cumulativeCount);
      }
    }
  }
  if (!found) {
    return null;
  }
  const buckets = [...cumulativeByLe.entries()]
    .map(([le, cumulativeCount]) => ({ le, cumulativeCount }))
    .sort((a, b) => a.le - b.le);
  return { count, sum, buckets };
}

/**
 * Cuantil `q` (0–1) sobre cubos acumulativos de un histograma (interpolación
 * lineal dentro del cubo, como `histogram_quantile` de Prometheus). Devuelve el
 * valor en las unidades del `le` (aquí segundos), o `null` si no hay datos. Un
 * `q` que cae en el cubo +Inf devuelve el último `le` finito (no se interpola a
 * infinito).
 */
export function histogramQuantile(
  buckets: HistogramView['buckets'],
  count: number,
  q: number,
): number | null {
  if (count <= 0 || q <= 0 || q > 1 || buckets.length === 0) {
    return null;
  }
  const rank = q * count;
  let prevLe = 0;
  let prevCount = 0;
  for (const bucket of buckets) {
    if (bucket.cumulativeCount >= rank) {
      const bucketCount = bucket.cumulativeCount - prevCount;
      if (bucketCount <= 0) {
        return bucket.le;
      }
      const frac = (rank - prevCount) / bucketCount;
      return prevLe + frac * (bucket.le - prevLe);
    }
    prevLe = bucket.le;
    prevCount = bucket.cumulativeCount;
  }
  // El rango cae más allá del último cubo finito (cubo +Inf): no interpolable.
  return buckets[buckets.length - 1].le;
}

/**
 * Diferencia entre dos lecturas acumulativas del **mismo** histograma (cubos
 * alineados por `le`), para obtener la distribución **del último intervalo** (lo
 * que quiere un dashboard en vivo, no la distribución desde el arranque). `null`
 * si los cubos no coinciden o no hubo observaciones nuevas.
 */
export function deltaHistogram(prev: HistogramView, curr: HistogramView): HistogramView | null {
  if (prev.buckets.length !== curr.buckets.length) {
    return null;
  }
  const prevByLe = new Map(prev.buckets.map((b) => [b.le, b.cumulativeCount]));
  const buckets: { le: number; cumulativeCount: number }[] = [];
  for (const bucket of curr.buckets) {
    const before = prevByLe.get(bucket.le);
    if (before === undefined) {
      return null;
    }
    buckets.push({ le: bucket.le, cumulativeCount: Math.max(0, bucket.cumulativeCount - before) });
  }
  const count = curr.count - prev.count;
  if (count <= 0) {
    return null;
  }
  return { count, sum: Math.max(0, curr.sum - prev.sum), buckets };
}

/** Convierte segundos → milisegundos, preservando `null`. */
export function toMillis(seconds: number | null): number | null {
  return seconds === null ? null : seconds * 1000;
}
