import { Activity, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import type { LiveStatus } from '@/features/live/use-live-stream';

interface StatusMeta {
  readonly label: string;
  readonly dot: string;
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly spin?: boolean;
}

const STATUS_META: Record<LiveStatus, StatusMeta> = {
  connecting: { label: 'Conectando…', dot: 'bg-faint-foreground', Icon: LoaderCircle, spin: true },
  live: { label: 'En vivo (SSE)', dot: 'bg-success', Icon: Activity },
  polling: { label: 'Polling (snapshot)', dot: 'bg-warning', Icon: RefreshCw },
  error: { label: 'Sin datos', dot: 'bg-critical', Icon: TriangleAlert },
};

/**
 * Píldora de estado del flujo en vivo. El significado lo lleva la **etiqueta de
 * texto** junto al icono (no solo el color del punto), como exige la skill para
 * los colores de estado.
 */
export function LiveBadge({ status }: { readonly status: LiveStatus }): ReactNode {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
      <span aria-hidden className={`size-2 rounded-full ${meta.dot}`} />
      <meta.Icon aria-hidden className={`size-3.5 ${meta.spin === true ? 'animate-spin' : ''}`} />
      {meta.label}
    </span>
  );
}
