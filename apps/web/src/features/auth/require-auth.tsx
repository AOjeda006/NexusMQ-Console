import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ProblemAlert } from '@/components/ui/problem-alert';
import { Spinner } from '@/components/ui/spinner';
import { problemFrom } from '@/lib/problem';

import { useAccess } from './use-auth';

function CenteredScreen({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">{children}</div>
  );
}

/**
 * Guard de rutas. Resuelve el estado de acceso antes de montar el shell:
 * - `authenticated` / `open` ⇒ deja pasar.
 * - `locked` ⇒ redirige al login, recordando la ruta de origen.
 * - cargando / error ⇒ pantalla de transición honesta (con reintento).
 */
export function RequireAuth({ children }: { readonly children: ReactNode }): ReactNode {
  const access = useAccess();
  const location = useLocation();

  if (access.isPending) {
    return (
      <CenteredScreen>
        <Spinner label="Comprobando sesión…" />
      </CenteredScreen>
    );
  }

  if (access.isError) {
    return (
      <CenteredScreen>
        <div className="w-full max-w-md">
          <ProblemAlert problem={problemFrom(access.error)} onRetry={() => void access.refetch()} />
        </div>
      </CenteredScreen>
    );
  }

  if (access.data === 'locked') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
