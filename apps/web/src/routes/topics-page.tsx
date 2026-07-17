import { Inbox, Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { CreateTopicDialog } from '@/features/topics/create-topic-dialog';
import { TopicDetail } from '@/features/topics/topic-detail';
import { TopicsTable } from '@/features/topics/topics-table';
import { useTopics } from '@/features/topics/use-topics';
import { cn } from '@/lib/cn';
import { problemFrom } from '@/lib/problem';

const PAGE_SIZE = 20;

/**
 * Gestión de **topics** (F3.2): listar (paginado), crear, describir (config +
 * particiones), editar retención (`PATCH`) y borrar; todo contra el broker real
 * vía BFF con el cliente tipado. La lista y el detalle se recargan de la caché
 * invalidada tras cada mutación, así la UI refleja el estado real del broker.
 */
export function TopicsPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending, isError, error, refetch, isFetching } = useTopics(page, PAGE_SIZE);
  const hasPrev = page > 1;
  const hasNext = data !== undefined && data.items.length === PAGE_SIZE;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Topics del broker vía BFF: crea, describe, ajusta la retención y borra.
        </p>
        <div className="flex items-center gap-3">
          {isFetching && !isPending && <Spinner label="Actualizando…" />}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden className="size-4" />
            Crear topic
          </Button>
        </div>
      </header>

      {isPending && (
        <Card className="flex items-center justify-center py-14">
          <Spinner label="Cargando topics…" />
        </Card>
      )}

      {isError && <ProblemAlert problem={problemFrom(error)} onRetry={() => void refetch()} />}

      {data !== undefined && (
        <div className={cn('grid gap-4', selectedName !== null && 'xl:grid-cols-2')}>
          <div className="space-y-2">
            {data.items.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                  <Inbox aria-hidden className="size-6" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {hasPrev ? 'No hay más topics' : 'No hay topics todavía'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {hasPrev
                      ? 'Vuelve a la página anterior.'
                      : 'Crea el primero con «Crear topic».'}
                  </p>
                </div>
              </Card>
            ) : (
              <TopicsTable
                topics={data.items}
                selectedName={selectedName}
                onSelect={setSelectedName}
              />
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

          {selectedName !== null && (
            <TopicDetail
              name={selectedName}
              onDeleted={() => setSelectedName(null)}
              onClose={() => setSelectedName(null)}
            />
          )}
        </div>
      )}

      <CreateTopicDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setSelectedName}
      />
    </section>
  );
}
