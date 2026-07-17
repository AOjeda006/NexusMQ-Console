import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { problemFrom } from '@/lib/problem';

import { useCreateTopic } from './use-topic-mutations';

/**
 * Diálogo de alta de topic (`POST /api/v1/topics`). Recoge nombre, particiones y
 * factor de replicación; la retención se ajusta luego con el `PATCH` desde el
 * detalle. Los errores del broker (p. ej. `409` nombre en uso) se muestran como
 * RFC 7807. Al crear, selecciona el nuevo topic.
 */
export function CreateTopicDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (name: string) => void;
}): ReactNode {
  const create = useCreateTopic();
  const [name, setName] = useState('');
  const [partitionCount, setPartitionCount] = useState('1');
  const [replicationFactor, setReplicationFactor] = useState('1');

  const reset = (): void => {
    setName('');
    setPartitionCount('1');
    setReplicationFactor('1');
    create.reset();
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    create.mutate(
      {
        name: trimmed,
        partitionCount: Number(partitionCount) || 1,
        replicationFactor: Number(replicationFactor) || 1,
        // Defaults del contrato (0 = por defecto del broker; -1 = sin límite); la
        // retención se ajusta luego con el PATCH desde el detalle.
        segmentBytes: 0,
        retentionMs: -1,
        retentionBytes: -1,
      },
      {
        onSuccess: (summary) => {
          onCreated(summary.name);
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Crear topic"
      description="El broker es la autoridad: el nombre debe ser único."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre" htmlFor="topic-name" hint="Identificador único del topic.">
          <Input
            id="topic-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            spellCheck={false}
            placeholder="p. ej. orders.events"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Particiones" htmlFor="topic-partitions">
            <Input
              id="topic-partitions"
              type="number"
              min={1}
              value={partitionCount}
              onChange={(e) => setPartitionCount(e.target.value)}
            />
          </Field>
          <Field label="Factor de replicación" htmlFor="topic-rf">
            <Input
              id="topic-rf"
              type="number"
              min={1}
              value={replicationFactor}
              onChange={(e) => setReplicationFactor(e.target.value)}
            />
          </Field>
        </div>

        {create.isError && <ProblemAlert problem={problemFrom(create.error)} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={name.trim() === '' || create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear topic'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
