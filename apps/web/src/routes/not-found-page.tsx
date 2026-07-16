import { Compass } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';

/** Ruta desconocida dentro del shell: mensaje claro y vuelta al Dashboard. */
export function NotFoundPage(): ReactNode {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 px-8 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted text-primary">
        <Compass aria-hidden className="size-7" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Página no encontrada</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          La ruta que buscas no existe en la consola.
        </p>
      </div>
      <Link
        to="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Volver al Dashboard
      </Link>
    </Card>
  );
}
