import type uPlot from 'uplot';

/**
 * Modelo **puro** de las vistas de historia (Prometheus). Aquí viven los presets
 * de ventana temporal, los constructores de PromQL y el parseo/alineado de la
 * respuesta `matrix` a datos de uPlot. No hay React ni red: todo es testeable.
 *
 * Nota de contrato: la forma `query_range` es del **BFF** (su data source de
 * Prometheus, F1.6), no del OpenAPI del broker, así que estos tipos se declaran
 * a mano a propósito (no son tipos del contrato).
 */

/** Preset de ventana temporal: cuánto historial y a qué resolución se muestrea. */
export interface RangePreset {
  readonly id: string;
  readonly label: string;
  readonly durationMs: number;
  /** Resolución de muestreo (`step` de Prometheus). */
  readonly step: string;
  /** Ventana de `rate()`/agregación del histograma (≥ step, para suavizar). */
  readonly window: string;
}

/** Presets ofrecidos en la UI. `step`/`window` crecen con la ventana (≈120 puntos). */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: '15m', label: '15 min', durationMs: 15 * 60_000, step: '15s', window: '1m' },
  { id: '1h', label: '1 h', durationMs: 60 * 60_000, step: '1m', window: '2m' },
  { id: '6h', label: '6 h', durationMs: 6 * 3_600_000, step: '5m', window: '10m' },
  { id: '24h', label: '24 h', durationMs: 24 * 3_600_000, step: '20m', window: '40m' },
];

/** Ventana resuelta (instantes Unix en segundos) lista para `query_range`. */
export interface HistoryWindow {
  readonly startS: number;
  readonly endS: number;
  readonly step: string;
  readonly window: string;
}

/** Resuelve el rango `[ahora − duración, ahora]` en segundos Unix. */
export function resolveWindow(preset: RangePreset, nowMs: number): HistoryWindow {
  const endS = Math.floor(nowMs / 1000);
  const startS = endS - Math.floor(preset.durationMs / 1000);
  return { startS, endS, step: preset.step, window: preset.window };
}

/**
 * Ids de métrica de historia (allow-list). El cliente **no** envía PromQL: elige
 * un id de esta lista y el BFF construye la PromQL en servidor contra los nombres
 * REALES del broker (`docs/metrics.md` de `../NexusMQ`). Debe casar con
 * `apps/bff/src/prometheus/history-metrics.ts` (fuente de verdad del allow-list).
 *
 * @see ../../../../../../NexusMQ/docs/metrics.md — catálogo de métricas del broker.
 */
export const HISTORY_METRIC_ID = {
  throughputProduce: 'throughput-produce',
  throughputFetch: 'throughput-fetch',
  latencyP50: 'latency-p50',
  latencyP99: 'latency-p99',
  latencyP999: 'latency-p999',
} as const;

/** Una serie de la respuesta `matrix` de Prometheus. */
export interface PromSeries {
  readonly metric: Record<string, string>;
  readonly values: readonly (readonly [number, string])[];
}

/** Respuesta de historia del BFF: datos, o degradación limpia sin Prometheus. */
export type HistoryResponse =
  | { readonly available: true; readonly resultType: string; readonly result: readonly PromSeries[] }
  | { readonly available: false; readonly reason: string };

/** Punto de una serie ya normalizado; `NaN` de Prometheus se vuelve `null` (hueco). */
export interface SeriesPoint {
  readonly ts: number;
  readonly v: number | null;
}

/**
 * Toma la **primera** serie de una matriz y la normaliza. Nuestras queries
 * agregan a una sola serie (`sum(...)`), así que basta con la primera; una
 * matriz vacía degrada a `[]`.
 */
export function firstSeriesPoints(result: readonly PromSeries[]): readonly SeriesPoint[] {
  const series = result[0];
  if (series === undefined) {
    return [];
  }
  return series.values.map(([ts, raw]) => {
    const value = Number(raw);
    return { ts, v: Number.isFinite(value) ? value : null };
  });
}

/** Serie a alinear: sus puntos y un multiplicador (p. ej. 1000 para s → ms). */
export interface AlignedInput {
  readonly points: readonly SeriesPoint[];
  readonly scale: number;
}

/**
 * Alinea varias series a una `AlignedData` de uPlot. Las series comparten la
 * rejilla temporal (mismo `start/end/step`), pero por robustez el eje X se
 * construye con la **unión ordenada** de instantes; los huecos quedan `null`.
 */
export function alignSeries(inputs: readonly AlignedInput[]): uPlot.AlignedData {
  const timestamps = new Set<number>();
  for (const input of inputs) {
    for (const point of input.points) {
      timestamps.add(point.ts);
    }
  }
  const xs = [...timestamps].sort((a, b) => a - b);
  const indexByTs = new Map(xs.map((ts, index) => [ts, index]));
  const ys = inputs.map((input) => {
    const column: (number | null)[] = xs.map(() => null);
    for (const point of input.points) {
      const index = indexByTs.get(point.ts);
      if (index !== undefined) {
        column[index] = point.v === null ? null : point.v * input.scale;
      }
    }
    return column;
  });
  return [xs, ...ys] as uPlot.AlignedData;
}

/** ¿La `AlignedData` tiene al menos un instante en el eje X? */
export function hasData(data: uPlot.AlignedData): boolean {
  return (data[0]?.length ?? 0) > 0;
}
