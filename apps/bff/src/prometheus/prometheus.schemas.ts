import { z } from 'zod';

import { HISTORY_METRIC_IDS } from './history-metrics';

/** Duración Prometheus estricta (p. ej. `15s`, `2m`, `1h`); nunca PromQL. */
const promDuration = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,4}(ms|s|m|h)$/, 'debe ser una duración Prometheus (p. ej. 15s, 2m, 1h).');

/** Timestamp Unix en segundos (entero). */
const unixSeconds = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, 'debe ser un timestamp Unix en segundos.');

/**
 * Parámetros de `query_range`: **no** aceptan PromQL cruda. El cliente elige un
 * `metric` de la **allow-list** (el BFF construye la PromQL en servidor) y aporta
 * el rango/step/ventana **validados** (`start`/`end` en segundos Unix; `step`/
 * `window` como duraciones Prometheus estrictas). Ver `history-metrics.ts`.
 */
export const queryRangeSchema = z.object({
  metric: z.enum(HISTORY_METRIC_IDS, {
    errorMap: () => ({ message: 'métrica no permitida (fuera de la allow-list).' }),
  }),
  start: unixSeconds,
  end: unixSeconds,
  step: promDuration,
  window: promDuration,
});

export type QueryRangeParams = z.infer<typeof queryRangeSchema>;
