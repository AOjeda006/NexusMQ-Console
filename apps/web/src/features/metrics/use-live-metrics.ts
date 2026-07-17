import { useCallback, useEffect, useRef, useState } from 'react';

import { type LiveSource, type LiveStatus, useLiveStream } from '@/features/live/use-live-stream';

import {
  deltaHistogram,
  findCounter,
  findGauge,
  findHistogram,
  histogramQuantile,
  METRIC,
  type MetricsSnapshot,
  toMillis,
} from './metrics-snapshot';

/** Muestra derivada de un frame: tasas (por diferencia) y cuantiles de latencia. */
export interface MetricsSample {
  readonly tMs: number;
  /** Mensajes de entrada por segundo (por diferencia del counter). */
  readonly msgInPerSec: number | null;
  readonly msgOutPerSec: number | null;
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
  /** Conexiones activas (gauge), o `null` si el broker no la expone. */
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

/**
 * Deriva una muestra a partir del frame actual y el anterior. Las tasas salen de
 * la diferencia de counters; los cuantiles de latencia, del histograma **del
 * intervalo** (diferencia de cubos) para reflejar la latencia reciente, con
 * respaldo al histograma acumulado si aún no hay intervalo.
 */
function deriveSample(
  prev: PrevFrame | null,
  snapshot: MetricsSnapshot,
  tMs: number,
): MetricsSample {
  let msgInPerSec: number | null = null;
  let msgOutPerSec: number | null = null;
  if (prev !== null) {
    const dt = (tMs - prev.tMs) / 1000;
    msgInPerSec = rate(
      findCounter(prev.snapshot, METRIC.messagesIn),
      findCounter(snapshot, METRIC.messagesIn),
      dt,
    );
    msgOutPerSec = rate(
      findCounter(prev.snapshot, METRIC.messagesOut),
      findCounter(snapshot, METRIC.messagesOut),
      dt,
    );
  }

  let p50Ms: number | null = null;
  let p99Ms: number | null = null;
  let p999Ms: number | null = null;
  const hist = findHistogram(snapshot, METRIC.produceLatency);
  if (hist !== null) {
    const prevHist = prev === null ? null : findHistogram(prev.snapshot, METRIC.produceLatency);
    const window = prevHist === null ? null : deltaHistogram(prevHist, hist);
    const source = window ?? hist;
    p50Ms = toMillis(histogramQuantile(source.buckets, source.count, QUANTILES.p50));
    p99Ms = toMillis(histogramQuantile(source.buckets, source.count, QUANTILES.p99));
    p999Ms = toMillis(histogramQuantile(source.buckets, source.count, QUANTILES.p999));
  }

  return { tMs, msgInPerSec, msgOutPerSec, p50Ms, p99Ms, p999Ms };
}

/**
 * Suscribe el Dashboard al flujo de métricas del broker (SSE del BFF con
 * **fallback a polling**, vía {@link useLiveStream}) y **deriva** en el cliente
 * lo que el snapshot no trae ya calculado: throughput por segundo (diferencia de
 * counters) y latencias p50/p99/p999 (cuantiles del histograma del intervalo),
 * acumulando una ventana deslizante para las gráficas en vivo. La derivación es
 * pura y está en `metrics-snapshot.ts` (con tests); aquí solo se orquesta el
 * estado por frame.
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
