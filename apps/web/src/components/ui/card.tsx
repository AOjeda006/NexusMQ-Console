import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Superficie de tarjeta: el contenedor base sobre el que se montan métricas,
 * tablas y gráficas. Usa la superficie de tarjeta del sistema (`bg-surface`) y
 * un anillo hairline, así se separa del plano de página sin sombras pesadas.
 */
export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div className={cn('rounded-xl border border-border bg-surface', className)} {...props}>
      {children}
    </div>
  );
}
