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
 * Nombres de métrica que consume el Dashboard. El `MetricsSnapshot` del contrato
 * es una lista **abierta** de series (`name` libre, estilo Prometheus): el
 * contrato no fija los nombres, así que la consola los asume aquí, en un único
 * sitio, y **degrada con honestidad** (muestra «—») si una serie no está
 * presente. Convención `nexusmq_*` alineada con la exposición Prometheus del
 * broker (`GET /metrics`).
 */
export const METRIC = {
  messagesIn: 'nexusmq_messages_in_total',
  messagesOut: 'nexusmq_messages_out_total',
  produceLatency: 'nexusmq_produce_latency_seconds',
  connections: 'nexusmq_connections_active',
} as const;

/** Suma el `value` de todas las series `counter` con ese nombre (o `null` si no hay ninguna). */
export function findCounter(snapshot: MetricsSnapshot, name: string): number | null {
  return sumValues(snapshot, name, 'counter');
}

/** Suma el `value` de todas las series `gauge` con ese nombre (o `null` si no hay ninguna). */
export function findGauge(snapshot: MetricsSnapshot, name: string): number | null {
  return sumValues(snapshot, name, 'gauge');
}

function sumValues(
  snapshot: MetricsSnapshot,
  name: string,
  type: MetricSample['type'],
): number | null {
  let total = 0;
  let found = false;
  for (const sample of snapshot.metrics) {
    if (sample.name === name && sample.type === type && typeof sample.value === 'number') {
      total += sample.value;
      found = true;
    }
  }
  return found ? total : null;
}

/**
 * Primer histograma con ese nombre, normalizado a {@link HistogramView} con los
 * cubos ordenados por `le` ascendente. `null` si no existe o le faltan cubos.
 */
export function findHistogram(snapshot: MetricsSnapshot, name: string): HistogramView | null {
  const sample = snapshot.metrics.find((m) => m.name === name && m.type === 'histogram');
  if (sample === undefined || sample.buckets === undefined) {
    return null;
  }
  const buckets = sample.buckets
    .map((b) => ({ le: b.le, cumulativeCount: b.cumulativeCount }))
    .sort((a, b) => a.le - b.le);
  return { count: sample.count ?? 0, sum: sample.sum ?? 0, buckets };
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
