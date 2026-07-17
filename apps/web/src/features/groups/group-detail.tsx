import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { problemFrom } from '@/lib/problem';

import { GroupStateBadge } from './group-state-badge';
import { useGroup } from './use-group';

const NUM = new Intl.NumberFormat('es-ES');

/**
 * Detalle de un grupo de consumo: estado, miembros y **offsets confirmados por
 * partición con su lag** (`highWatermark - committedOffset`), el dato clave para
 * ver cuánto va por detrás cada consumidor. Solo lectura (los grupos no se mutan).
 */
export function GroupDetail({
  id,
  onClose,
}: {
  readonly id: string;
  readonly onClose: () => void;
}): ReactNode {
  const { data, isPending, isError, error, refetch } = useGroup(id);
  const totalLag = data?.offsets.reduce((sum, o) => sum + o.lag, 0) ?? 0;

  return (
    <Card className="flex flex-col gap-5 p-5" data-testid="group-detail">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground" title={id}>
            {id}
          </h2>
          <p className="text-xs text-muted-foreground">Miembros, offsets y lag por partición</p>
        </div>
        <Button variant="ghost" onClick={onClose} aria-label="Cerrar detalle" className="shrink-0">
          <X aria-hidden className="size-4" />
        </Button>
      </header>

      {isPending && (
        <div className="flex justify-center py-10">
          <Spinner label="Describiendo grupo…" />
        </div>
      )}

      {isError && <ProblemAlert problem={problemFrom(error)} onRetry={() => void refetch()} />}

      {data !== undefined && (
        <>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-faint-foreground">Estado</dt>
              <dd>
                <GroupStateBadge state={data.state} />
              </dd>
            </div>
            <Meta label="Generación" value={String(data.generation)} />
            <Meta label="Lag total" value={NUM.format(totalLag)} />
          </dl>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Miembros ({data.members.length})
            </h3>
            {data.members.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                El grupo no tiene miembros activos.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {data.members.map((member) => (
                  <li
                    key={member.memberId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="truncate font-medium text-foreground" title={member.memberId}>
                      {member.memberId}
                      {member.memberId === data.leaderId && (
                        <span className="ml-2 text-xs font-normal text-primary">líder</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {NUM.format(member.subscriptionBytes)} B susc.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Offsets por partición ({data.offsets.length})
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Topic
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Part.
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Committed
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      High-watermark
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Lag
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.offsets.map((offset) => (
                    <tr
                      key={`${offset.topic}-${offset.partition}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{offset.topic}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {offset.partition}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {NUM.format(offset.committedOffset)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {NUM.format(offset.highWatermark)}
                      </td>
                      <td
                        className={
                          offset.lag > 0
                            ? 'px-3 py-2.5 text-right font-medium tabular-nums text-foreground'
                            : 'px-3 py-2.5 text-right tabular-nums text-muted-foreground'
                        }
                        data-testid="offset-lag"
                      >
                        {NUM.format(offset.lag)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
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
