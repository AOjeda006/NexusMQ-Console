import { useQueries } from '@tanstack/react-query';

import { ProblemError, toProblem } from '@/lib/problem';

import {
  firstSeriesPoints,
  type HistoryResponse,
  type HistoryWindow,
  type SeriesPoint,
} from './history-range';

/** Una serie a consultar: un id estable y el id de métrica de la allow-list del BFF. */
export interface RangeSpec {
  readonly id: string;
  readonly metric: string;
}

interface RangeSeries {
  readonly available: boolean;
  readonly points: readonly SeriesPoint[];
}

async function fetchRangeSeries(
  metric: string,
  window: HistoryWindow,
  signal: AbortSignal,
): Promise<RangeSeries> {
  const params = new URLSearchParams({
    metric,
    start: String(window.startS),
    end: String(window.endS),
    step: window.step,
    window: window.window,
  });
  const response = await fetch(`/api/history/query_range?${params.toString()}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ProblemError(toProblem(body, response.status));
  }
  const body = (await response.json()) as HistoryResponse;
  if (!body.available) {
    return { available: false, points: [] };
  }
  return { available: true, points: firstSeriesPoints(body.result) };
}

/** Resultado combinado de las series de historia para un rango. */
export interface HistorySeries {
  /** Puntos por id de serie (vacío mientras carga o si no hay datos). */
  readonly byId: ReadonlyMap<string, readonly SeriesPoint[]>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  /** `false` si el BFF señaliza que Prometheus no está configurado. */
  readonly available: boolean;
}

/**
 * Consulta en paralelo varias series de `query_range` (una por spec) para la
 * misma ventana. Comparten `start/end/step`, así que la rejilla temporal casa y
 * se pueden alinear luego. Se desactiva con `enabled` (p. ej. si Prometheus no
 * está disponible) para no disparar peticiones inútiles.
 */
export function useHistorySeries(
  specs: readonly RangeSpec[],
  window: HistoryWindow,
  options: { readonly enabled: boolean },
): HistorySeries {
  const results = useQueries({
    queries: specs.map((spec) => ({
      queryKey: ['history-range', spec.id, spec.metric, window.startS, window.endS, window.step],
      queryFn: ({ signal }: { readonly signal: AbortSignal }): Promise<RangeSeries> =>
        fetchRangeSeries(spec.metric, window, signal),
      enabled: options.enabled,
      staleTime: 15_000,
    })),
  });

  const byId = new Map<string, readonly SeriesPoint[]>();
  specs.forEach((spec, index) => {
    byId.set(spec.id, results[index]?.data?.points ?? []);
  });

  const firstError = results.find((result) => result.error)?.error ?? null;
  return {
    byId,
    isLoading: results.some((result) => result.isLoading && result.fetchStatus !== 'idle'),
    isError: results.some((result) => result.isError),
    error: firstError,
    available: !results.some((result) => result.data?.available === false),
  };
}
