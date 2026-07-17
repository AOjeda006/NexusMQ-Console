import { Trash2, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { problemFrom } from '@/lib/problem';

import { DeleteTopicDialog } from './delete-topic-dialog';
import { RetentionForm } from './retention-form';
import { useTopic } from './use-topic';

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Detalle de un topic: **describe** (`GET /api/v1/topics/{name}`) su config de
 * retención y sus particiones, permite **editar la retención** (`PATCH`) y
 * **borrarlo** (`DELETE`). Se muestra al seleccionar una fila de la lista.
 */
export function TopicDetail({
  name,
  onDeleted,
  onClose,
}: {
  readonly name: string;
  readonly onDeleted: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { data, isPending, isError, error, refetch } = useTopic(name);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-5 p-5" data-testid="topic-detail">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground" title={name}>
            {name}
          </h2>
          <p className="text-xs text-muted-foreground">Detalle y configuración del topic</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden className="size-4" />
            Eliminar
          </Button>
          <Button variant="ghost" onClick={onClose} aria-label="Cerrar detalle">
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      </header>

      {isPending && (
        <div className="flex justify-center py-10">
          <Spinner label="Describiendo topic…" />
        </div>
      )}

      {isError && <ProblemAlert problem={problemFrom(error)} onRetry={() => void refetch()} />}

      {data !== undefined && (
        <>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <Meta label="Particiones" value={String(data.partitionCount)} />
            <Meta label="Factor réplica" value={String(data.replicationFactor)} />
            <Meta label="Creado" value={DATE_FORMAT.format(data.createdAtMs)} />
          </dl>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Retención</h3>
            <RetentionForm key={name} name={name} config={data.config} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Particiones ({data.partitions.length})
            </h3>
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
                  </tr>
                </thead>
                <tbody>
                  {data.partitions.map((partition) => (
                    <tr key={partition.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5 font-medium text-foreground">p{partition.id}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        Nodo {partition.leader}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {partition.highWatermark.toLocaleString('es-ES')}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {partition.leaderEpoch}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <DeleteTopicDialog
        name={name}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={onDeleted}
      />
    </Card>
  );
}

function Meta({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-faint-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
