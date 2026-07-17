import { type ReactNode, useCallback, useMemo } from 'react';
import type uPlot from 'uplot';

import { useVizTokens } from '@/features/viz/use-viz-tokens';
import type { MetricsSample } from '@/features/metrics/use-live-metrics';

import { compact } from './format';
import { LiveUplot } from './live-uplot';
import { makeLiveOptions } from './uplot-live-options';

/**
 * Throughput en vivo (mensajes/s de entrada y salida) como serie temporal uPlot.
 * Dos series ⇒ leyenda presente (regla dataviz); color de la paleta categórica
 * en orden fijo (entrada = slot 1, salida = slot 2). uPlot por rendimiento de
 * streaming: los frames se empujan sin reconstruir la gráfica.
 */
export function ThroughputChart({
  history,
}: {
  readonly history: readonly MetricsSample[];
}): ReactNode {
  const tokens = useVizTokens();

  const data = useMemo<uPlot.AlignedData>(() => {
    const xs = history.map((s) => s.tMs / 1000);
    const inflow = history.map((s) => s.msgInPerSec);
    const outflow = history.map((s) => s.msgOutPerSec);
    return [xs, inflow, outflow];
  }, [history]);

  const makeOptions = useCallback(
    (width: number, height: number): uPlot.Options =>
      makeLiveOptions({
        width,
        height,
        tokens,
        series: [
          { label: 'Entrada', stroke: tokens.series[0] },
          { label: 'Salida', stroke: tokens.series[1] },
        ],
        formatY: (v) => compact(v, 0),
        fill: true,
      }),
    [tokens],
  );

  return (
    <LiveUplot
      makeOptions={makeOptions}
      data={data}
      className="h-full w-full"
      ariaLabel="Throughput en vivo: mensajes por segundo de entrada y salida"
    />
  );
}
