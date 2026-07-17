import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { ClusterRaftPanel } from '@/features/dashboard/cluster-raft-panel';
import { compact, integer, millis } from '@/features/dashboard/format';
import { LatencyChart } from '@/features/dashboard/latency-chart';
import { LiveBadge } from '@/features/dashboard/live-badge';
import { StatTile } from '@/features/dashboard/stat-tile';
import { ThroughputChart } from '@/features/dashboard/throughput-chart';
import { summarizeCluster, useCluster } from '@/features/cluster/use-cluster';
import { useLiveMetrics } from '@/features/metrics/use-live-metrics';

/** Punto de color de identidad de una serie (nunca es el propio número). */
function SeriesDot({ className }: { readonly className: string }): ReactNode {
  return <span aria-hidden className={`size-2.5 rounded-full ${className}`} />;
}

/**
 * Dashboard vivo (F3.1): throughput, latencias p50/p99/p999, salud del clúster y
 * estado Raft, todo en tiempo real. Las métricas llegan por el **SSE del BFF**
 * (con fallback a polling) y se derivan en el cliente (`useLiveMetrics`); el
 * estado del clúster se sondea aparte (`useCluster`), pues no viaja por el SSE.
 */
export function DashboardPage(): ReactNode {
  const metrics = useLiveMetrics();
  const clusterQuery = useCluster();
  const current = metrics.current;
  const health = clusterQuery.data ? summarizeCluster(clusterQuery.data) : null;

  return (
    <div
      className="space-y-4"
      data-testid="dashboard"
      data-status={metrics.status}
      data-source={metrics.source ?? ''}
      data-updated={metrics.lastUpdatedAtMs ?? ''}
      data-samples={metrics.history.length}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Métricas y consenso en tiempo real del broker.
        </p>
        <LiveBadge status={metrics.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Entrada"
          value={compact(current?.msgInPerSec ?? null, 1)}
          unit="msg/s"
          mark={<SeriesDot className="bg-series-1" />}
          sub={<span>Conexiones activas: {integer(metrics.connections)}</span>}
          testId="kpi-in"
        />
        <StatTile
          label="Salida"
          value={compact(current?.msgOutPerSec ?? null, 1)}
          unit="msg/s"
          mark={<SeriesDot className="bg-series-2" />}
          testId="kpi-out"
        />
        <StatTile
          label="Latencia p99"
          value={millis(current?.p99Ms ?? null)}
          sub={
            <span>
              p50 {millis(current?.p50Ms ?? null)} · p999 {millis(current?.p999Ms ?? null)}
            </span>
          }
          testId="kpi-p99"
        />
        <StatTile
          label="Clúster"
          value={health ? integer(health.nodeCount) : '—'}
          unit="nodos"
          sub={
            <ClusterHealthLine
              healthy={health?.healthy ?? null}
              withoutLeader={health?.withoutLeader ?? 0}
              term={health?.maxTerm ?? null}
            />
          }
          testId="kpi-cluster"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Throughput (mensajes/s)">
          <ThroughputChart history={metrics.history} />
        </ChartCard>
        <ChartCard title="Latencia de publicación (p50 · p99 · p999)">
          <LatencyChart history={metrics.history} />
        </ChartCard>
      </div>

      <ClusterRaftPanel query={clusterQuery} />
    </div>
  );
}

function ChartCard({
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

/** Línea de salud del clúster con icono + etiqueta (color de estado nunca solo). */
function ClusterHealthLine({
  healthy,
  withoutLeader,
  term,
}: {
  readonly healthy: boolean | null;
  readonly withoutLeader: number;
  readonly term: number | null;
}): ReactNode {
  if (healthy === null) {
    return <span>—</span>;
  }
  if (healthy) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 aria-hidden className="size-3.5 text-success" />
        Saludable · término {integer(term)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-critical">
      <TriangleAlert aria-hidden className="size-3.5" />
      {withoutLeader} partición(es) sin líder
    </span>
  );
}
