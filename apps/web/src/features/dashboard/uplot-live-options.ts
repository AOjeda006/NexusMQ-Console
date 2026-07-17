import type uPlot from 'uplot';

import type { VizTokens } from '@/features/viz/use-viz-tokens';

/** Serie de una gráfica en vivo: etiqueta (leyenda) y color ya resuelto. */
export interface LiveSeriesSpec {
  readonly label: string;
  readonly stroke: string;
}

/** `#rrggbb` → `rgba(r,g,b,a)` para rellenos translúcidos (uPlot pinta en canvas). */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return hex;
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Opciones de uPlot para una gráfica de series temporales **en vivo**, con los
 * tokens dataviz: eje X temporal, rejilla/ejes recesivos, marcas de 2px, leyenda
 * (obligatoria con ≥2 series) y crucero de cursor. El color de cada serie sale
 * de la paleta categórica en orden fijo (lo pasa el llamador); el texto (ejes,
 * leyenda) viste tinta, nunca el color de serie.
 */
export function makeLiveOptions(params: {
  readonly width: number;
  readonly height: number;
  readonly tokens: VizTokens;
  readonly series: readonly LiveSeriesSpec[];
  readonly formatY: (value: number) => string;
  readonly fill?: boolean;
}): uPlot.Options {
  const { width, height, tokens, series, formatY, fill = false } = params;
  const axis = {
    stroke: tokens.mutedForeground,
    grid: { stroke: tokens.grid, width: 1 },
    ticks: { stroke: tokens.axis, width: 1 },
    font: '11px system-ui, sans-serif',
  };

  return {
    width,
    height,
    cursor: { y: false, points: { size: 6 } },
    legend: { show: true },
    scales: { x: { time: true } },
    axes: [
      { ...axis },
      { ...axis, size: 52, values: (_self, splits) => splits.map((v) => formatY(v)) },
    ],
    series: [
      {},
      ...series.map((spec) => ({
        label: spec.label,
        stroke: spec.stroke,
        width: 2,
        points: { show: false },
        ...(fill ? { fill: withAlpha(spec.stroke, 0.1) } : {}),
      })),
    ],
  };
}
