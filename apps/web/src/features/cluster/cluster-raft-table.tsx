import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { maxFollowerLag, partitionKey, type PartitionRaftInfo } from './use-cluster';

const NUM = new Intl.NumberFormat('es-ES');

const ROLE_LABEL: Record<PartitionRaftInfo['role'], string> = {
  leader: 'Líder',
  follower: 'Seguidor',
  candidate: 'Candidato',
  pre_candidate: 'Precandidato',
  unknown: 'Desconocido',
};

/**
 * Tabla del consenso Raft por partición, **seleccionable**: la fila activa
 * gobierna qué partición dibuja la topología 3D. Muestra rol, líder, término,
 * commit index y el retraso máximo de seguidor.
 */
export function ClusterRaftTable({
  partitions,
  activeKey,
  onSelect,
}: {
  readonly partitions: readonly PartitionRaftInfo[];
  readonly activeKey: string | null;
  readonly onSelect: (partition: PartitionRaftInfo) => void;
}): ReactNode {
  return (
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
          {partitions.map((partition) => {
            const key = partitionKey(partition);
            const selected = key === activeKey;
            const lag = maxFollowerLag(partition);
            return (
              <tr
                key={key}
                aria-selected={selected}
                className={cn(
                  'cursor-pointer border-b border-border transition-colors last:border-0',
                  selected ? 'bg-primary/10' : 'hover:bg-muted',
                )}
                onClick={() => onSelect(partition)}
              >
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="rounded font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {partition.topic}-p{partition.partition}
                  </button>
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
                  {NUM.format(partition.term)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {NUM.format(partition.commitIndex)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right tabular-nums',
                    lag > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {NUM.format(lag)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
