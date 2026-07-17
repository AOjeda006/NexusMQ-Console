import { Inbox } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { GroupDetail } from '@/features/groups/group-detail';
import { GroupsTable } from '@/features/groups/groups-table';
import { useGroups } from '@/features/groups/use-groups';
import { cn } from '@/lib/cn';
import { problemFrom } from '@/lib/problem';

const PAGE_SIZE = 20;

/**
 * Grupos de consumo (F3.3): listar (paginado) y **describir** (miembros, offsets
 * confirmados y lag por partición) contra el broker real vía BFF. Solo lectura.
 */
export function GroupsPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch, isFetching } = useGroups(page, PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = data !== undefined && data.items.length === PAGE_SIZE;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Grupos de consumo del broker vía BFF: estado, miembros y lag por partición.
        </p>
        {isFetching && !isPending && <Spinner label="Actualizando…" />}
      </header>

      {isPending && (
        <Card className="flex items-center justify-center py-14">
          <Spinner label="Cargando grupos…" />
        </Card>
      )}

      {isError && <ProblemAlert problem={problemFrom(error)} onRetry={() => void refetch()} />}

      {data !== undefined && (
        <div className={cn('grid gap-4', selectedId !== null && 'xl:grid-cols-2')}>
          <div className="space-y-2">
            {data.items.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                  <Inbox aria-hidden className="size-6" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {hasPrev ? 'No hay más grupos' : 'No hay grupos activos'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {hasPrev
                      ? 'Vuelve a la página anterior.'
                      : 'Cuando haya consumidores, sus grupos aparecerán aquí.'}
                  </p>
                </div>
              </Card>
            ) : (
              <GroupsTable groups={data.items} selectedId={selectedId} onSelect={setSelectedId} />
            )}

            <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
              <Button
                variant="ghost"
                disabled={!hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-faint-foreground">Página {data.page}</span>
              <Button variant="ghost" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </nav>
          </div>

          {selectedId !== null && (
            <GroupDetail id={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
      )}
    </section>
  );
}
