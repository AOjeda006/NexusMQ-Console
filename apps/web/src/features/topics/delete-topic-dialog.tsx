import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { problemFrom } from '@/lib/problem';

import { useDeleteTopic } from './use-topic-mutations';

/**
 * Confirmación de borrado (`DELETE /api/v1/topics/{name}`). Acción destructiva
 * irreversible (borra el topic y sus datos en disco): botón `danger` y aviso
 * explícito. Al borrar, cierra y notifica para deseleccionar el topic.
 */
export function DeleteTopicDialog({
  name,
  open,
  onOpenChange,
  onDeleted,
}: {
  readonly name: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted: () => void;
}): ReactNode {
  const remove = useDeleteTopic();

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      remove.reset();
    }
    onOpenChange(next);
  };

  const onConfirm = (): void => {
    remove.mutate(name, {
      onSuccess: () => {
        onDeleted();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Borrar topic"
      description="Se elimina el topic y sus datos en disco. Esta acción no se puede deshacer."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          ¿Seguro que quieres borrar <span className="font-medium text-foreground">{name}</span>?
        </p>

        {remove.isError && <ProblemAlert problem={problemFrom(remove.error)} />}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={remove.isPending}>
            {remove.isPending ? 'Borrando…' : 'Borrar topic'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
