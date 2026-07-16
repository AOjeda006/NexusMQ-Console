import { z } from 'zod';

/**
 * Parámetros de un `query_range` de Prometheus. `start`/`end` admiten RFC 3339 o
 * timestamp Unix, y `step` una duración (`15s`) o segundos; se validan como
 * cadenas no vacías y Prometheus decide su semántica exacta (un valor inválido
 * vuelve como 400 propagado).
 */
export const queryRangeSchema = z.object({
  query: z.string().trim().min(1, 'query (PromQL) es obligatorio.'),
  start: z.string().trim().min(1, 'start es obligatorio.'),
  end: z.string().trim().min(1, 'end es obligatorio.'),
  step: z.string().trim().min(1, 'step es obligatorio.'),
});

export type QueryRangeParams = z.infer<typeof queryRangeSchema>;
