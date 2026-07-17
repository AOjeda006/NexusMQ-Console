import { type ReactNode, Suspense, lazy, useState } from 'react';

import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { ClusterRaftTable } from '@/features/cluster/cluster-raft-table';
import { partitionKey, summarizeCluster, useCluster } from '@/features/cluster/use-cluster';
import { useVizTokens } from '@/features/viz/use-viz-tokens';
import { cn } from '@/lib/cn';
import { problemFrom } from '@/lib/problem';

// three.js es pesado: la topología va en su propio chunk (carga diferida) para no
// inflar el bundle principal de la consola.
const ClusterTopology = lazy(() =>
  import('@/features/cluster/cluster-topology').then((m) => ({ default: m.ClusterTopology })),
);

const NUM = new Intl.NumberFormat('es-ES');

/**
 * Vista de **Cluster / Raft** (F3.5): nodos, roles, término, commit index, líder
 * por partición y lag de seguidor, con una **topología 3D** (react-three-fiber)
 * como pieza central que responde a la partición seleccionada. Datos reales de
 * `GET /api/v1/cluster` vía BFF, sondeados en vivo.
 */
export function ClusterPage(): ReactNode {
  const tokens = useVizTokens();
  const { data, isPending, isError, error, refetch } = useCluster();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (isPending) {
    return (
      <Card className="flex items-center justify-center py-16">
        <Spinner label="Cargando estado del clúster…" />
      </Card>
    );
  }
  if (isError || data === undefined) {
    return <ProblemAlert problem={problemFrom(error)} onRetry={() => void refetch()} />;
  }

  const health = summarizeCluster(data);
  const active =
    data.partitions.find((p) => partitionKey(p) === activeKey) ?? data.partitions[0] ?? null;

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nodos, consenso Raft por partición y topología de replicación, en vivo vía BFF.
      </p>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <ul className="flex flex-wrap gap-2">
          {data.nodes.map((node) => (
            <li
              key={node.nodeId}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                node.isSelf
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border bg-surface text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: tokens.series[(node.nodeId - 1) % tokens.series.length] }}
              />
              Nodo {node.nodeId}
              {node.isSelf && <span className="text-faint-foreground">(local)</span>}
            </li>
          ))}
        </ul>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Stat label="Particiones" value={NUM.format(health.partitionCount)} />
          <Stat label="Término máx." value={NUM.format(health.maxTerm)} />
          <Stat label="Lag máx." value={NUM.format(health.maxFollowerLag)} />
        </dl>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Topología de replicación</h2>
            {active !== null && (
              <span className="text-xs text-muted-foreground" data-testid="topology-leader">
                {active.topic}-p{active.partition} · líder:{' '}
                {active.leader < 0 ? 'sin líder' : `Nodo ${active.leader}`}
              </span>
            )}
          </div>
          <Suspense
            fallback={
              <div className="flex h-80 items-center justify-center">
                <Spinner label="Cargando topología 3D…" />
              </div>
            }
          >
            <ClusterTopology
              cluster={data}
              tokens={tokens}
              active={active}
              className="h-80 w-full overflow-hidden rounded-lg"
              ariaLabel="Topología 3D del clúster con las aristas de replicación de la partición activa"
            />
          </Suspense>
          <p className="text-xs text-faint-foreground">
            El nodo local lleva halo; el líder de la partición seleccionada pulsa y proyecta aristas
            a sus seguidores (color por lag). Elige una fila para cambiar de partición.
          </p>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-medium text-foreground">Consenso Raft por partición</h2>
          {data.partitions.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              Sin particiones replicadas (factor de replicación 1): no hay consenso que mostrar.
            </p>
          ) : (
            <ClusterRaftTable
              partitions={data.partitions}
              activeKey={active === null ? null : partitionKey(active)}
              onSelect={(partition) => setActiveKey(partitionKey(partition))}
            />
          )}
        </Card>
      </div>
    </section>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-faint-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
