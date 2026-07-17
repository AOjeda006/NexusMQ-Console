import { type ReactNode, useCallback } from 'react';
import type uPlot from 'uplot';

import { compact, millis } from '@/features/dashboard/format';
import { LiveUplot } from '@/features/dashboard/live-uplot';
import { makeLiveOptions } from '@/features/dashboard/uplot-live-options';
import { useVizTokens } from '@/features/viz/use-viz-tokens';

/**
 * Gráfica de una serie temporal **histórica** (Prometheus `query_range`). Reusa
 * el motor uPlot del dashboard (`LiveUplot` + `makeLiveOptions`) con los tokens
 * dataviz: eje X temporal, leyenda con ≥2 series y color de la paleta categórica
 * en **orden fijo** (misma asignación que en el dashboard, para que una métrica
 * conserve su color entre vistas). Solo se reconstruye al cambiar de tema.
 */
export function HistoryChart({
  data,
  labels,
  unit,
  fill = false,
  ariaLabel,
}: {
  readonly data: uPlot.AlignedData;
  readonly labels: readonly string[];
  readonly unit: 'count' | 'millis';
  readonly fill?: boolean;
  readonly ariaLabel: string;
}): ReactNode {
  const tokens = useVizTokens();

  const makeOptions = useCallback(
    (width: number, height: number): uPlot.Options =>
      makeLiveOptions({
        width,
        height,
        tokens,
        series: labels.map((label, index) => ({ label, stroke: tokens.series[index] })),
        formatY: unit === 'millis' ? (v): string => millis(v) : (v): string => compact(v, 0),
        fill,
      }),
    [tokens, labels, unit, fill],
  );

  return (
    <LiveUplot
      makeOptions={makeOptions}
      data={data}
      className="h-full w-full"
      ariaLabel={ariaLabel}
    />
  );
}
