import { type ReactNode, useCallback, useMemo } from 'react';
import type uPlot from 'uplot';

import { useVizTokens } from '@/features/viz/use-viz-tokens';
import type { MetricsSample } from '@/features/metrics/use-live-metrics';

import { millis } from './format';
import { LiveUplot } from './live-uplot';
import { makeLiveOptions } from './uplot-live-options';

/**
 * Latencias de publicación p50/p99/p999 (ms) en vivo. Tres series ⇒ leyenda
 * presente; color categórico en orden fijo (p50 = slot 1, p99 = slot 2, p999 =
 * slot 3). Los cuantiles se derivan del histograma del intervalo en
 * `useLiveMetrics`; aquí solo se dibujan.
 */
export function LatencyChart({
  history,
}: {
  readonly history: readonly MetricsSample[];
}): ReactNode {
  const tokens = useVizTokens();

  const data = useMemo<uPlot.AlignedData>(() => {
    const xs = history.map((s) => s.tMs / 1000);
    return [
      xs,
      history.map((s) => s.p50Ms),
      history.map((s) => s.p99Ms),
      history.map((s) => s.p999Ms),
    ];
  }, [history]);

  const makeOptions = useCallback(
    (width: number, height: number): uPlot.Options =>
      makeLiveOptions({
        width,
        height,
        tokens,
        series: [
          { label: 'p50', stroke: tokens.series[0] },
          { label: 'p99', stroke: tokens.series[1] },
          { label: 'p999', stroke: tokens.series[2] },
        ],
        formatY: (v) => millis(v),
      }),
    [tokens],
  );

  return (
    <LiveUplot
      makeOptions={makeOptions}
      data={data}
      className="h-full w-full"
      ariaLabel="Latencias de publicación en vivo: percentiles p50, p99 y p999 en milisegundos"
    />
  );
}
