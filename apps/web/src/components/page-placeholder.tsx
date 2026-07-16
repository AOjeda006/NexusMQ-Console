import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

interface PagePlaceholderProps {
  readonly Icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  /** Fase del plan en la que esta vista se llena con datos reales. */
  readonly phase: string;
}

/**
 * Estado vacío honesto para las secciones cuyo contenido con datos reales llega
 * en una fase posterior: no simula datos, deja claro qué mostrará y cuándo. El
 * shell (F2.1) queda navegable y con el sistema de diseño aplicado.
 */
export function PagePlaceholder({
  Icon,
  title,
  description,
  phase,
}: PagePlaceholderProps): ReactNode {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 px-8 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted text-primary">
        <Icon aria-hidden className="size-7" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-faint-foreground">
        Con datos reales en {phase}
      </span>
    </Card>
  );
}
