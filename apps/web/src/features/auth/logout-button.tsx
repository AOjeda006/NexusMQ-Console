import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

import { useAccess, useLogout } from './use-auth';

/**
 * Botón de cierre de sesión. Solo aparece cuando hay sesión de operador (en modo
 * abierto no hay nada que cerrar). Tras el logout, la caché se invalida y el
 * guard de rutas lleva al login automáticamente.
 */
export function LogoutButton(): ReactNode {
  const access = useAccess();
  const logoutMutation = useLogout();

  if (access.data !== 'authenticated') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => logoutMutation.mutate()}
      disabled={logoutMutation.isPending}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut aria-hidden className="size-4" />
    </button>
  );
}
