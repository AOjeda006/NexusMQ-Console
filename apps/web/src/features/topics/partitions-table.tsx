import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';

import type { PartitionRaftView } from '@/features/cluster/use-cluster';
import { cn } from '@/lib/cn';

import type { PartitionInfo } from './use-topic';

const NUM = new Intl.NumberFormat('es-ES');

/**
 * Detalle de particiones de un topic (F3.4). Cruza lo que devuelve el **describe**
 * (líder, high-watermark, época) con el estado **Raft** del clúster indexado por
 * `topic#partición`, para añadir el **lag de réplica** (que no viaja en el
 * describe). Las particiones sin réplica en el consenso (rf = 1 o no lideradas
 * por este nodo) muestran «—» en el lag, coherente con el describe.
 */
export function PartitionsTable({
  topicName,
  partitions,
  raft,
}: {
  readonly topicName: string;
  readonly partitions: readonly PartitionInfo[];
  readonly raft: Map<string, PartitionRaftView> | null;
}): ReactNode {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2.5 font-medium">
              Partición
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Líder
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              High-watermark
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Época
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Lag réplica
            </th>
          </tr>
        </thead>
        <tbody>
          {partitions.map((partition) => {
            const view = raft?.get(`${topicName}#${partition.id}`) ?? null;
            return (
              <tr key={partition.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    p{partition.id}
                    {view?.role === 'leader' && (
                      <Crown aria-hidden className="size-3.5 text-primary" />
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  Nodo {partition.leader}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {NUM.format(partition.highWatermark)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {partition.leaderEpoch}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right tabular-nums',
                    view === null
                      ? 'text-faint-foreground'
                      : view.maxLag > 0
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground',
                  )}
                  data-testid="partition-lag"
                >
                  {view === null ? '—' : NUM.format(view.maxLag)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
