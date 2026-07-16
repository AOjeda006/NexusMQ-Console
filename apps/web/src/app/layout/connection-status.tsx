import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Estado de la sesión con el broker (vía BFF). Ampliará en F2.2. */
export type ConnectionState = 'disconnected' | 'connected' | 'error';

interface StateStyle {
  readonly label: string;
  readonly hint: string;
  readonly dot: string;
}

const STATES: Record<ConnectionState, StateStyle> = {
  disconnected: {
    label: 'Sin sesión',
    hint: 'Aún no hay sesión con el broker. El inicio de sesión llega con la capa de datos (F2.2).',
    dot: 'bg-faint-foreground',
  },
  connected: {
    label: 'Conectado',
    hint: 'Sesión activa: el BFF está sirviendo datos del broker.',
    dot: 'bg-success',
  },
  error: {
    label: 'Sin conexión',
    hint: 'No se pudo contactar con el broker a través del BFF.',
    dot: 'bg-critical',
  },
};

/**
 * Píldora de estado de conexión. El significado lo lleva la etiqueta de texto
 * (no solo el punto de color); el tooltip Radix da el detalle al pasar por
 * encima o al enfocar con teclado.
 */
export function ConnectionStatus({
  state = 'disconnected',
}: {
  state?: ConnectionState;
}): ReactNode {
  const { label, hint, dot } = STATES[state];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden className={cn('size-2 rounded-full', dot)} />
          <span>{label}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className="max-w-64 rounded-lg border border-border bg-elevated px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-lg"
        >
          {hint}
          <Tooltip.Arrow className="fill-elevated" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
