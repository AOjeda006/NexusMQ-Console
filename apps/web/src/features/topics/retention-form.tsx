import { Check } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { problemFrom } from '@/lib/problem';

import { formatBytes, formatRetentionMs } from './format';
import type { TopicConfigView } from './use-topic';
import { useAlterRetention } from './use-topic-mutations';

/**
 * Formulario de **retención mutable en caliente** (`PATCH /api/v1/topics/{name}`).
 * Muestra los valores vigentes (que vienen de describir el topic) y aplica los
 * nuevos; tras el PATCH, la caché se invalida y la **descripción se vuelve a pedir
 * al broker**, así que el «vigente» de arriba refleja el efecto real, no un valor
 * optimista. `segmentBytes` no se edita (create-only por contrato).
 */
export function RetentionForm({
  name,
  config,
}: {
  readonly name: string;
  readonly config: TopicConfigView;
}): ReactNode {
  const alter = useAlterRetention();
  const [retentionMs, setRetentionMs] = useState(String(config.retentionMs));
  const [retentionBytes, setRetentionBytes] = useState(String(config.retentionBytes));

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    alter.mutate({
      name,
      body: {
        retentionMs: Number(retentionMs),
        retentionBytes: Number(retentionBytes),
      },
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <div className="space-y-0.5">
          <dt className="text-xs uppercase tracking-wide text-faint-foreground">
            Retención (tiempo)
          </dt>
          <dd className="font-medium text-foreground" data-testid="retention-ms">
            {formatRetentionMs(config.retentionMs)}
          </dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-xs uppercase tracking-wide text-faint-foreground">
            Retención (tamaño)
          </dt>
          <dd className="font-medium text-foreground" data-testid="retention-bytes">
            {formatBytes(config.retentionBytes)}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-3">
        <Field label="retentionMs" htmlFor="retention-ms-input" hint="-1 = sin límite.">
          <Input
            id="retention-ms-input"
            type="number"
            value={retentionMs}
            onChange={(e) => setRetentionMs(e.target.value)}
          />
        </Field>
        <Field label="retentionBytes" htmlFor="retention-bytes-input" hint="-1 = sin límite.">
          <Input
            id="retention-bytes-input"
            type="number"
            value={retentionBytes}
            onChange={(e) => setRetentionBytes(e.target.value)}
          />
        </Field>
      </div>

      {alter.isError && <ProblemAlert problem={problemFrom(alter.error)} />}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={alter.isPending}>
          {alter.isPending ? 'Aplicando…' : 'Aplicar retención'}
        </Button>
        {alter.isSuccess && !alter.isPending && (
          <span
            className="inline-flex items-center gap-1.5 text-sm text-success-text"
            data-testid="retention-applied"
          >
            <Check aria-hidden className="size-4" />
            Aplicada
          </span>
        )}
      </div>
    </form>
  );
}
