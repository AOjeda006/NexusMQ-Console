import type { UseQueryResult } from '@tanstack/react-query';
import { Crown, Server } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { problemFrom } from '@/lib/problem';
import type { ClusterInfo, PartitionRaftInfo } from '@/features/cluster/use-cluster';

import { integer } from './format';

const ROLE_LABEL: Record<PartitionRaftInfo['role'], string> = {
  leader: 'Líder',
  follower: 'Seguidor',
  candidate: 'Candidato',
  pre_candidate: 'Precandidato',
  unknown: 'Desconocido',
};

/** Retraso máximo de cualquier seguidor de una partición (0 si no hay seguidores). */
function maxLag(partition: PartitionRaftInfo): number {
  return partition.followers.reduce((max, f) => Math.max(max, f.lag), 0);
}

function partitionLabel(partition: PartitionRaftInfo): string {
  return `${partition.topic}-p${partition.partition}`;
}

/**
 * Panel de salud del clúster y estado Raft en el Dashboard: nodos conocidos (con
 * el nodo local marcado) y una tabla compacta del consenso por partición (líder,
 * rol, término, commit index y retraso máximo de seguidor). El detalle profundo
 * (época, lag por seguidor, topología 3D) es F3.4/F3.5; aquí es el pulso.
 */
export function ClusterRaftPanel({
  query,
}: {
  readonly query: UseQueryResult<ClusterInfo, Error>;
}): ReactNode {
  if (query.data === undefined) {
    return (
      <Card className="flex min-h-40 items-center justify-center p-6">
        {query.isError ? (
          <ProblemAlert problem={problemFrom(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <Spinner label="Cargando estado del clúster…" />
        )}
      </Card>
    );
  }

  const cluster = query.data;
  return (
    <Card className="flex flex-col gap-4 p-4" data-testid="cluster-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Clúster y consenso (Raft)</h2>
        <ul className="flex flex-wrap gap-2">
          {cluster.nodes.map((node) => (
            <li
              key={node.nodeId}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                node.isSelf
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border bg-surface text-muted-foreground',
              )}
            >
              <Server aria-hidden className="size-3.5" />
              Nodo {node.nodeId}
              {node.isSelf && <span className="text-faint-foreground">(local)</span>}
            </li>
          ))}
        </ul>
      </div>

      {cluster.partitions.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
          Sin particiones replicadas (factor de replicación 1): no hay consenso Raft que mostrar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Partición
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Rol
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Líder
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Término
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Commit
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Lag máx.
                </th>
              </tr>
            </thead>
            <tbody>
              {cluster.partitions.map((partition) => {
                const lag = maxLag(partition);
                return (
                  <tr
                    key={partitionLabel(partition)}
                    className="border-b border-border last:border-0 hover:bg-muted"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {partitionLabel(partition)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        {partition.role === 'leader' && (
                          <Crown aria-hidden className="size-3.5 text-primary" />
                        )}
                        {ROLE_LABEL[partition.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {partition.leader < 0 ? (
                        <span className="text-warning">sin líder</span>
                      ) : (
                        `Nodo ${partition.leader}`
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {integer(partition.term)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {integer(partition.commitIndex)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right tabular-nums',
                        lag > 0 ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {integer(lag)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
