import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ProblemError, toProblem } from '@/lib/problem';

/** Disponibilidad de las vistas de historia (Prometheus) que expone el BFF. */
export interface HistoryStatus {
  readonly available: boolean;
}

async function fetchHistoryStatus(): Promise<HistoryStatus> {
  const response = await fetch('/api/history/status', { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new ProblemError(toProblem(undefined, response.status));
  }
  return (await response.json()) as HistoryStatus;
}

/**
 * Consulta si la historia (Prometheus) está disponible (`GET /api/history/status`,
 * ruta abierta del BFF). No forma parte del contrato del broker, así que se llama
 * con `fetch` directo. Se refresca con poca frecuencia (es config de despliegue).
 */
export function useHistoryStatus(): UseQueryResult<HistoryStatus, Error> {
  return useQuery({
    queryKey: ['history-status'],
    queryFn: fetchHistoryStatus,
    staleTime: 60_000,
  });
}
