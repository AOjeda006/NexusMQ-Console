import { CircleCheck, CircleDashed, CircleHelp, CircleX, RefreshCw } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { GroupState } from './use-groups';

interface StateMeta {
  readonly label: string;
  readonly dot: string;
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const STATE_META: Record<GroupState, StateMeta> = {
  Stable: { label: 'Estable', dot: 'bg-success', Icon: CircleCheck },
  PreparingRebalance: { label: 'Rebalanceando (prep.)', dot: 'bg-warning', Icon: RefreshCw },
  CompletingRebalance: { label: 'Rebalanceando (fin)', dot: 'bg-warning', Icon: RefreshCw },
  Dead: { label: 'Muerto', dot: 'bg-critical', Icon: CircleX },
  Empty: { label: 'Vacío', dot: 'bg-faint-foreground', Icon: CircleDashed },
  Unknown: { label: 'Desconocido', dot: 'bg-faint-foreground', Icon: CircleHelp },
};

/**
 * Píldora del estado de un grupo. El significado lo lleva la **etiqueta + icono**
 * (no solo el color del punto), como exige la skill dataviz para los estados.
 */
export function GroupStateBadge({ state }: { readonly state: GroupState }): ReactNode {
  const meta = STATE_META[state];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
      <span aria-hidden className={`size-2 rounded-full ${meta.dot}`} />
      <meta.Icon aria-hidden className="size-3.5" />
      {meta.label}
    </span>
  );
}
