import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

import { useAccess } from '@/features/auth/use-auth';
import { cn } from '@/lib/cn';

type DisplayState = 'checking' | 'authenticated' | 'open' | 'error';

interface StateStyle {
  readonly label: string;
  readonly hint: string;
  readonly dot: string;
}

const STATES: Record<DisplayState, StateStyle> = {
  checking: {
    label: 'Comprobando…',
    hint: 'Resolviendo el estado de sesión con el broker a través del BFF.',
    dot: 'bg-faint-foreground',
  },
  authenticated: {
    label: 'Sesión activa',
    hint: 'Token de operador confinado en el servidor; el BFF sirve datos del broker.',
    dot: 'bg-success',
  },
  open: {
    label: 'Modo abierto',
    hint: 'El broker no exige autenticación; la consola opera sin iniciar sesión.',
    dot: 'bg-primary',
  },
  error: {
    label: 'Sin conexión',
    hint: 'No se pudo contactar con el broker a través del BFF.',
    dot: 'bg-critical',
  },
};

function toDisplayState(access: ReturnType<typeof useAccess>): DisplayState {
  if (access.isError) {
    return 'error';
  }
  if (access.data === 'authenticated') {
    return 'authenticated';
  }
  if (access.data === 'open') {
    return 'open';
  }
  return 'checking';
}

/**
 * Píldora de estado de conexión, derivada del estado de acceso real (sesión +
 * modo del broker). El significado lo lleva la etiqueta de texto (no solo el
 * punto de color); el tooltip Radix da el detalle al pasar por encima o al
 * enfocar con teclado.
 */
export function ConnectionStatus(): ReactNode {
  const access = useAccess();
  const { label, hint, dot } = STATES[toDisplayState(access)];
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
