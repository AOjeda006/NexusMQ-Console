import { type ReactNode, useCallback, useMemo } from 'react';
import type uPlot from 'uplot';

import { useVizTokens } from '@/features/viz/use-viz-tokens';
import type { MetricsSample } from '@/features/metrics/use-live-metrics';

import { compact } from './format';
import { LiveUplot } from './live-uplot';
import { makeLiveOptions } from './uplot-live-options';

/**
 * Throughput en vivo (peticiones/s por `api`: produce y fetch) como serie
 * temporal uPlot. Dos series ⇒ leyenda presente (regla dataviz); color de la
 * paleta categórica en orden fijo (produce = slot 1, fetch = slot 2). uPlot por
 * rendimiento de streaming: los frames se empujan sin reconstruir la gráfica.
 */
export function ThroughputChart({
  history,
}: {
  readonly history: readonly MetricsSample[];
}): ReactNode {
  const tokens = useVizTokens();

  const data = useMemo<uPlot.AlignedData>(() => {
    const xs = history.map((s) => s.tMs / 1000);
    const produce = history.map((s) => s.produceReqPerSec);
    const fetch = history.map((s) => s.fetchReqPerSec);
    return [xs, produce, fetch];
  }, [history]);

  const makeOptions = useCallback(
    (width: number, height: number): uPlot.Options =>
      makeLiveOptions({
        width,
        height,
        tokens,
        series: [
          { label: 'Produce', stroke: tokens.series[0] },
          { label: 'Fetch', stroke: tokens.series[1] },
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
      ariaLabel="Throughput en vivo: peticiones por segundo de produce y fetch"
    />
  );
}
