import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Indicador de carga accesible: icono giratorio + etiqueta para lectores. */
export function Spinner({
  label = 'Cargando…',
  className,
}: {
  readonly label?: string;
  readonly className?: string;
}): ReactNode {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
    >
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </span>
  );
}
