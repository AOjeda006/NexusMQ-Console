import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/input';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { useAccess, useLogin, useLogout } from '@/features/auth/use-auth';
import { cn } from '@/lib/cn';
import { problemFrom } from '@/lib/problem';

/**
 * Gestión de sesión desde Ajustes: muestra el estado de acceso real (sesión +
 * modo del broker) y permite **iniciar y cerrar sesión desde la UI**. El token de
 * operador se envía al BFF, que lo valida y lo confina en servidor; el navegador
 * solo recibe la cookie httpOnly.
 */
export function SessionCard(): ReactNode {
  const access = useAccess();
  const login = useLogin();
  const logout = useLogout();
  const [token, setToken] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = token.trim();
    if (value === '') {
      return;
    }
    login.mutate(value, { onSuccess: () => setToken('') });
  };

  return (
    <Card className="space-y-4 p-5" data-testid="session-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Sesión</h2>
          <p className="text-xs text-muted-foreground">
            Acceso de operador (token confinado en el servidor).
          </p>
        </div>
        <AccessPill access={access.data} isError={access.isError} />
      </div>

      {access.data === 'authenticated' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Hay una sesión de operador activa.</p>
          <Button
            variant="ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            data-testid="settings-logout"
          >
            {logout.isPending ? 'Cerrando…' : 'Cerrar sesión'}
          </Button>
        </div>
      )}

      {access.data === 'open' && (
        <p className="text-sm text-muted-foreground">
          El broker está en <strong className="font-medium text-foreground">modo abierto</strong>:
          no exige autenticación, así que no hace falta iniciar sesión.
        </p>
      )}

      {access.data === 'locked' && (
        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            label="Token de operador"
            htmlFor="settings-token"
            hint="JWT del broker ya emitido. No se guarda en el navegador."
          >
            <textarea
              id="settings-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              autoComplete="off"
              spellCheck={false}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              className="w-full resize-none rounded-lg border border-border bg-page px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-faint-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
            />
          </Field>
          {login.isError && <ProblemAlert problem={problemFrom(login.error)} />}
          <Button type="submit" disabled={token.trim() === '' || login.isPending}>
            {login.isPending ? 'Validando…' : 'Iniciar sesión'}
          </Button>
        </form>
      )}
    </Card>
  );
}

function AccessPill({
  access,
  isError,
}: {
  readonly access: 'authenticated' | 'open' | 'locked' | undefined;
  readonly isError: boolean;
}): ReactNode {
  const meta = isError
    ? { label: 'Sin conexión', dot: 'bg-critical' }
    : access === 'authenticated'
      ? { label: 'Sesión activa', dot: 'bg-success' }
      : access === 'open'
        ? { label: 'Modo abierto', dot: 'bg-primary' }
        : access === 'locked'
          ? { label: 'Sin sesión', dot: 'bg-warning' }
          : { label: 'Comprobando…', dot: 'bg-faint-foreground' };
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
      <span aria-hidden className={cn('size-2 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}
