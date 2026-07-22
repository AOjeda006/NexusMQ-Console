import { LoaderCircle, ServerOff } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type uPlot from 'uplot';

import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { HistoryChart } from '@/features/history/history-chart';
import {
  alignSeries,
  hasData,
  HISTORY_METRIC_ID,
  RANGE_PRESETS,
  type RangePreset,
  resolveWindow,
} from '@/features/history/history-range';
import { RangeSelector } from '@/features/history/range-selector';
import { type RangeSpec, useHistorySeries } from '@/features/history/use-history';
import { useHistoryStatus } from '@/features/settings/use-history-status';
import { problemFrom } from '@/lib/problem';

const THROUGHPUT_LABELS = ['Produce', 'Fetch'] as const;
const LATENCY_LABELS = ['p50', 'p99', 'p999'] as const;

/**
 * Historia (F4.1): series temporales de throughput y latencias p50/p99/p999
 * consultadas al **data source de Prometheus** del BFF (`query_range`). Si el
 * BFF no tiene Prometheus configurado, degrada limpio con un aviso honesto (el
 * resto de la consola no depende de esto). El único filtro —la ventana temporal—
 * va en una fila sobre las gráficas (skill dataviz).
 */
export function HistoryPage(): ReactNode {
  const status = useHistoryStatus();
  const [range, setRange] = useState<{ preset: RangePreset; nowMs: number }>(() => ({
    preset: RANGE_PRESETS[1],
    nowMs: Date.now(),
  }));

  const window = resolveWindow(range.preset, range.nowMs);
  const specs: readonly RangeSpec[] = [
    { id: 'produce', metric: HISTORY_METRIC_ID.throughputProduce },
    { id: 'fetch', metric: HISTORY_METRIC_ID.throughputFetch },
    { id: 'p50', metric: HISTORY_METRIC_ID.latencyP50 },
    { id: 'p99', metric: HISTORY_METRIC_ID.latencyP99 },
    { id: 'p999', metric: HISTORY_METRIC_ID.latencyP999 },
  ];

  const available = status.data?.available === true;
  const series = useHistorySeries(specs, window, { enabled: available });

  const throughput = alignSeries([
    { points: series.byId.get('produce') ?? [], scale: 1 },
    { points: series.byId.get('fetch') ?? [], scale: 1 },
  ]);
  const latency = alignSeries([
    { points: series.byId.get('p50') ?? [], scale: 1000 },
    { points: series.byId.get('p99') ?? [], scale: 1000 },
    { points: series.byId.get('p999') ?? [], scale: 1000 },
  ]);

  return (
    <section className="space-y-4" data-testid="history">
      <p className="text-sm text-muted-foreground">
        Series temporales de throughput y latencias del broker, servidas por Prometheus vía el BFF.
      </p>

      {status.isLoading && <StatusSkeleton />}
      {status.isError && <ProblemAlert problem={problemFrom(status.error)} />}
      {status.data !== undefined && !available && <DegradedNotice />}

      {available && (
        <div className="space-y-4">
          <RangeSelector
            value={range.preset}
            onSelect={(preset) => setRange({ preset, nowMs: Date.now() })}
            onRefresh={() => setRange((prev) => ({ ...prev, nowMs: Date.now() }))}
            disabled={series.isLoading}
          />
          {series.isError && <ProblemAlert problem={problemFrom(series.error)} />}
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Throughput (peticiones/s)"
              data={throughput}
              loading={series.isLoading}
            >
              <HistoryChart
                data={throughput}
                labels={THROUGHPUT_LABELS}
                unit="count"
                fill
                ariaLabel="Throughput histórico: peticiones por segundo de produce y fetch"
              />
            </ChartCard>
            <ChartCard
              title="Latencia de servicio (p50 · p99 · p999)"
              data={latency}
              loading={series.isLoading}
            >
              <HistoryChart
                data={latency}
                labels={LATENCY_LABELS}
                unit="millis"
                ariaLabel="Latencias históricas: percentiles p50, p99 y p999 en milisegundos"
              />
            </ChartCard>
          </div>
        </div>
      )}
    </section>
  );
}

/** Tarjeta de gráfica con superposición honesta de carga / sin datos. */
function ChartCard({
  title,
  data,
  loading,
  children,
}: {
  readonly title: string;
  readonly data: uPlot.AlignedData;
  readonly loading: boolean;
  readonly children: ReactNode;
}): ReactNode {
  const overlay = loading ? 'loading' : hasData(data) ? null : 'empty';
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <div className="relative h-64">
        {children}
        {overlay !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70 text-sm text-muted-foreground">
            {overlay === 'loading' ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Cargando…
              </span>
            ) : (
              'Sin datos en el rango'
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Aviso honesto cuando el BFF no tiene Prometheus configurado (degradación limpia). */
function DegradedNotice(): ReactNode {
  return (
    <Card
      className="flex flex-col items-center gap-3 p-8 text-center"
      data-testid="history-degraded"
    >
      <div className="rounded-full border border-border bg-muted p-3">
        <ServerOff aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-foreground">Historia no disponible</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Las series temporales requieren un Prometheus configurado en el BFF (variable{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
            PROMETHEUS_URL
          </code>
          ). El resto de la consola funciona con normalidad; la historia aparecerá aquí en cuanto el
          despliegue la incluya.
        </p>
      </div>
    </Card>
  );
}

/** Esqueleto mientras se resuelve la disponibilidad de la historia. */
function StatusSkeleton(): ReactNode {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i} className="h-72 animate-pulse p-4" />
      ))}
    </div>
  );
}
