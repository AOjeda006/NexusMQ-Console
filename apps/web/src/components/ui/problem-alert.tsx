import { RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ProblemDetail } from '@/lib/problem';

import { Button } from './button';

interface ProblemAlertProps {
  readonly problem: ProblemDetail;
  readonly onRetry?: () => void;
}

/**
 * Muestra un error RFC 7807 de forma honesta y accesible: color de estado
 * `critical` **con icono + texto** (nunca solo color, por la regla de estado de
 * la skill dataviz), el `title`, el `detail` legible y el código HTTP.
 */
export function ProblemAlert({ problem, onRetry }: ProblemAlertProps): ReactNode {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-critical" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">{problem.title}</p>
        {problem.detail !== undefined && problem.detail !== '' && (
          <p className="text-sm text-muted-foreground">{problem.detail}</p>
        )}
        {problem.status > 0 && (
          <p className="text-xs text-faint-foreground">Código HTTP {problem.status}</p>
        )}
      </div>
      {onRetry !== undefined && (
        <Button variant="ghost" onClick={onRetry} className="shrink-0">
          <RefreshCw aria-hidden className="size-4" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
