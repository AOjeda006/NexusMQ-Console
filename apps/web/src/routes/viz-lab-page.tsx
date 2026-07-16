import type { EChartsOption } from 'echarts';
import { ArrowLeft } from 'lucide-react';
import { type ReactNode, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type uPlot from 'uplot';

import { ThemeToggle } from '@/app/theme/theme-toggle';
import { Card } from '@/components/ui/card';
import { EChart } from '@/features/viz/echart';
import { ThreeClusterScene } from '@/features/viz/three-cluster-scene';
import { UplotChart } from '@/features/viz/uplot-chart';
import { useVizTokens } from '@/features/viz/use-viz-tokens';
import { VisxAreaChart, type VisxPoint } from '@/features/viz/visx-area-chart';

const HOURS = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`);

/** Serie determinista (sin aleatoriedad → capturas estables). */
function wave(length: number, amplitude: number, phase: number, base: number): number[] {
  return Array.from(
    { length },
    (_, i) => Math.round((base + amplitude * (Math.sin(i / 2 + phase) + 1)) * 10) / 10,
  );
}

/**
 * Laboratorio de visualización (F2.3): una gráfica de cada librería del arsenal
 * —ECharts, uPlot, visx y react-three-fiber— con datos de ejemplo, todas
 * tomando color de los tokens dataviz y respetando el tema claro/oscuro. Las
 * vistas reales de la Fase 3 consumirán estos wrappers.
 */
export function VizLabPage(): ReactNode {
  const tokens = useVizTokens();

  const echartOption = useMemo<EChartsOption>(
    () => ({
      grid: { top: 36, right: 16, bottom: 28, left: 44 },
      tooltip: { trigger: 'axis' },
      legend: { top: 4, textStyle: { color: tokens.mutedForeground }, icon: 'roundRect' },
      color: tokens.series.slice(0, 3),
      xAxis: {
        type: 'category',
        data: HOURS,
        axisLine: { lineStyle: { color: tokens.axis } },
        axisTick: { show: false },
        axisLabel: { color: tokens.mutedForeground },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tokens.grid } },
        axisLabel: { color: tokens.mutedForeground },
      },
      series: [
        {
          name: 'p50',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          data: wave(12, 8, 0, 6),
        },
        {
          name: 'p99',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          data: wave(12, 14, 1, 18),
        },
        {
          name: 'p999',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          data: wave(12, 20, 2, 34),
        },
      ],
    }),
    [tokens],
  );

  const uplotData = useMemo<uPlot.AlignedData>(() => {
    const n = 160;
    const xs = Array.from({ length: n }, (_, i) => i);
    const y1 = xs.map((i) => 40 + 18 * Math.sin(i / 12) + 6 * Math.sin(i / 3));
    const y2 = xs.map((i) => 22 + 10 * Math.sin(i / 9 + 1.5));
    return [xs, y1, y2];
  }, []);

  const makeUplotOptions = useCallback(
    (width: number, height: number): uPlot.Options => ({
      width,
      height,
      cursor: { y: false },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [
        {
          stroke: tokens.mutedForeground,
          grid: { stroke: tokens.grid, width: 1 },
          ticks: { stroke: tokens.axis, width: 1 },
        },
        {
          stroke: tokens.mutedForeground,
          grid: { stroke: tokens.grid, width: 1 },
          ticks: { stroke: tokens.axis, width: 1 },
        },
      ],
      series: [
        {},
        { stroke: tokens.series[0], width: 2, points: { show: false } },
        { stroke: tokens.series[4], width: 2, points: { show: false } },
      ],
    }),
    [tokens],
  );

  const visxData = useMemo<VisxPoint[]>(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        x: i,
        y: 30 + 20 * Math.sin(i / 6) + 8 * Math.sin(i / 2),
      })),
    [],
  );

  return (
    <main className="min-h-screen bg-page px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Volver a la consola
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Laboratorio de visualización</h1>
            <p className="text-sm text-muted-foreground">
              Arsenal F2.3: ECharts · uPlot · visx · react-three-fiber. Tokens dataviz y tema
              claro/oscuro.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <VizCard title="ECharts · Latencias (p50/p99/p999)">
            <EChart option={echartOption} ariaLabel="Gráfica de líneas ECharts de latencias" />
          </VizCard>

          <VizCard title="uPlot · Throughput en el tiempo">
            <UplotChart
              makeOptions={makeUplotOptions}
              data={uplotData}
              className="h-full w-full"
              ariaLabel="Gráfica de series temporales uPlot de throughput"
            />
          </VizCard>

          <VizCard title="visx · Área de mensajes/s">
            <VisxAreaChart
              data={visxData}
              tokens={tokens}
              className="h-full w-full"
              ariaLabel="Gráfica de área visx de mensajes por segundo"
            />
          </VizCard>

          <VizCard title="react-three-fiber · Mini-topología del cluster">
            <ThreeClusterScene
              tokens={tokens}
              className="h-full w-full"
              ariaLabel="Escena 3D de la topología del cluster"
            />
          </VizCard>
        </div>
      </div>
    </main>
  );
}

function VizCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <div className="h-64">{children}</div>
    </Card>
  );
}
