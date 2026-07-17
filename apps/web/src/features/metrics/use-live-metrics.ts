import { useCallback, useEffect, useRef, useState } from 'react';

import { type LiveSource, type LiveStatus, useLiveStream } from '@/features/live/use-live-stream';

import {
  API,
  deltaHistogram,
  findCounter,
  findGauge,
  findHistogram,
  histogramQuantile,
  METRIC,
  type MetricsSnapshot,
  toMillis,
} from './metrics-snapshot';

/**
 * Muestra derivada de un frame del broker: tasas por `api` (por diferencia de
 * counters) y cuantiles de latencia de `produce`. Los nombres/labels son los
 * REALES del broker (`nexus_broker_*` con `{api}`); las series que el broker aún
 * no emita quedan `null` (degradan a «—» en la UI).
 */
export interface MetricsSample {
  readonly tMs: number;
  /** Peticiones/s de `produce` (delta del counter `requests_total{api=produce}`). */
  readonly produceReqPerSec: number | null;
  readonly fetchReqPerSec: number | null;
  /** Records (mensajes)/s por `api` (degrada si el broker no emite `messages_total`). */
  readonly produceMsgPerSec: number | null;
  readonly fetchMsgPerSec: number | null;
  /** Bytes de payload/s por `api`. */
  readonly produceBytesPerSec: number | null;
  readonly fetchBytesPerSec: number | null;
  /** Errores de wire/s (todas las `api`). */
  readonly errorPerSec: number | null;
  /** Latencia de servicio de `produce` (ms), del histograma del intervalo. */
  readonly p50Ms: number | null;
  readonly p99Ms: number | null;
  readonly p999Ms: number | null;
}

export interface LiveMetricsState {
  readonly status: LiveStatus;
  readonly source: LiveSource | null;
  readonly lastUpdatedAtMs: number | null;
  /** Última muestra derivada (o `null` mientras no llega el primer frame). */
  readonly current: MetricsSample | null;
  /** Ventana deslizante de muestras para las gráficas en vivo. */
  readonly history: readonly MetricsSample[];
  /** Conexiones activas (gauge, sumado por plane), o `null` si el broker no la expone. */
  readonly connections: number | null;
}

/** Puntos que retiene la ventana deslizante (a la cadencia del SSE, ~1 min). */
const MAX_POINTS = 150;

const QUANTILES = { p50: 0.5, p99: 0.99, p999: 0.999 } as const;

interface PrevFrame {
  readonly snapshot: MetricsSnapshot;
  readonly tMs: number;
}

/** Tasa (unidades/seg) por diferencia de un counter monótono entre dos frames. */
function rate(prev: number | null, curr: number | null, dtSeconds: number): number | null {
  if (prev === null || curr === null || dtSeconds <= 0 || curr < prev) {
    return null;
  }
  return (curr - prev) / dtSeconds;
}

/** Tasa por `api` de un counter entre dos frames (o `null` si la serie no está). */
function counterRate(
  prev: PrevFrame,
  snapshot: MetricsSnapshot,
  name: string,
  api: string,
  dtSeconds: number,
): number | null {
  return rate(
    findCounter(prev.snapshot, name, { api }),
    findCounter(snapshot, name, { api }),
    dtSeconds,
  );
}

/**
 * Deriva una muestra a partir del frame actual y el anterior. Las tasas salen de
 * la diferencia de counters **filtrados por label** (`{api}`); los cuantiles de
 * latencia, del histograma de `produce` **del intervalo** (diferencia de cubos)
 * para reflejar la latencia reciente, con respaldo al histograma acumulado si aún
 * no hay intervalo.
 */
function deriveSample(
  prev: PrevFrame | null,
  snapshot: MetricsSnapshot,
  tMs: number,
): MetricsSample {
  let produceReqPerSec: number | null = null;
  let fetchReqPerSec: number | null = null;
  let produceMsgPerSec: number | null = null;
  let fetchMsgPerSec: number | null = null;
  let produceBytesPerSec: number | null = null;
  let fetchBytesPerSec: number | null = null;
  let errorPerSec: number | null = null;
  if (prev !== null) {
    const dt = (tMs - prev.tMs) / 1000;
    produceReqPerSec = counterRate(prev, snapshot, METRIC.requests, API.produce, dt);
    fetchReqPerSec = counterRate(prev, snapshot, METRIC.requests, API.fetch, dt);
    produceMsgPerSec = counterRate(prev, snapshot, METRIC.messages, API.produce, dt);
    fetchMsgPerSec = counterRate(prev, snapshot, METRIC.messages, API.fetch, dt);
    produceBytesPerSec = counterRate(prev, snapshot, METRIC.requestBytes, API.produce, dt);
    fetchBytesPerSec = counterRate(prev, snapshot, METRIC.requestBytes, API.fetch, dt);
    errorPerSec = rate(
      findCounter(prev.snapshot, METRIC.requestErrors),
      findCounter(snapshot, METRIC.requestErrors),
      dt,
    );
  }

  let p50Ms: number | null = null;
  let p99Ms: number | null = null;
  let p999Ms: number | null = null;
  const hist = findHistogram(snapshot, METRIC.requestDuration, { api: API.produce });
  if (hist !== null) {
    const prevHist =
      prev === null ? null : findHistogram(prev.snapshot, METRIC.requestDuration, { api: API.produce });
    const window = prevHist === null ? null : deltaHistogram(prevHist, hist);
    const source = window ?? hist;
    p50Ms = toMillis(histogramQuantile(source.buckets, source.count, QUANTILES.p50));
    p99Ms = toMillis(histogramQuantile(source.buckets, source.count, QUANTILES.p99));
    p999Ms = toMillis(histogramQuantile(source.buckets, source.count, QUANTILES.p999));
  }

  return {
    tMs,
    produceReqPerSec,
    fetchReqPerSec,
    produceMsgPerSec,
    fetchMsgPerSec,
    produceBytesPerSec,
    fetchBytesPerSec,
    errorPerSec,
    p50Ms,
    p99Ms,
    p999Ms,
  };
}

/**
 * Suscribe el Dashboard al flujo de métricas del broker (SSE del BFF con
 * **fallback a polling**, vía {@link useLiveStream}) y **deriva** en el cliente
 * lo que el snapshot no trae ya calculado: throughput por `api` (diferencia de
 * counters filtrados por label) y latencias p50/p99/p999 de `produce` (cuantiles
 * del histograma del intervalo), acumulando una ventana deslizante para las
 * gráficas en vivo. La derivación es pura y está en `metrics-snapshot.ts` (con
 * tests); aquí solo se orquesta el estado por frame.
 */
export function useLiveMetrics(): LiveMetricsState {
  const parse = useCallback(
    (raw: string): MetricsSnapshot => JSON.parse(raw) as MetricsSnapshot,
    [],
  );
  const live = useLiveStream<MetricsSnapshot>({ parse });

  const [history, setHistory] = useState<readonly MetricsSample[]>([]);
  const [connections, setConnections] = useState<number | null>(null);
  const prevRef = useRef<PrevFrame | null>(null);

  const snapshot = live.data;
  const tMs = live.lastUpdatedAtMs;

  useEffect(() => {
    if (snapshot === undefined || tMs === null) {
      return;
    }
    const sample = deriveSample(prevRef.current, snapshot, tMs);
    prevRef.current = { snapshot, tMs };
    // Gauge sumado por plane (native+kafka+admin); «—» hasta que el broker lo emita.
    setConnections(findGauge(snapshot, METRIC.connections));
    setHistory((prev) => {
      const next = [...prev, sample];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
    // Una derivación por frame: `tMs` (marca de actualización) es la clave; el
    // snapshot se lee del mismo frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMs]);

  return {
    status: live.status,
    source: live.source,
    lastUpdatedAtMs: tMs,
    current: history.length > 0 ? history[history.length - 1] : null,
    history,
    connections,
  };
}
