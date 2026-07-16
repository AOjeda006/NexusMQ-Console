import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { useTopics } from '@/features/topics/use-topics';
import { TopicsTable } from '@/features/topics/topics-table';
import { problemFrom } from '@/lib/problem';

/**
 * Vista de prueba de la capa de datos (F2.2): lista los topics **reales** del
 * broker vía BFF con el cliente tipado + TanStack Query, cubriendo los tres
 * estados honestos (cargando, error RFC 7807, vacío). El CRUD completo es F3.2.
 */
export function TopicsPage(): ReactNode {
  const { data, isPending, isError, error, refetch, isFetching } = useTopics();

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Lista real del broker vía BFF (cliente tipado del contrato). El CRUD completo llega en la
          Fase 3.
        </p>
        {isFetching && !isPending && <Spinner label="Actualizando…" />}
      </header>

      {isPending && (
        <Card className="flex items-center justify-center py-14">
          <Spinner label="Cargando topics…" />
        </Card>
      )}

      {isError && <ProblemAlert problem={problemFrom(error)} onRetry={() => void refetch()} />}

      {data !== undefined &&
        (data.items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
              <Inbox aria-hidden className="size-6" />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">No hay topics todavía</h2>
              <p className="text-sm text-muted-foreground">
                Cuando el broker tenga topics, aparecerán aquí.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            <TopicsTable topics={data.items} />
            <p className="text-xs text-faint-foreground">
              {data.items.length} {data.items.length === 1 ? 'topic' : 'topics'} · página{' '}
              {data.page}
            </p>
          </div>
        ))}
    </section>
  );
}
