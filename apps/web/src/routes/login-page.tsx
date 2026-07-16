import { Waypoints } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProblemAlert } from '@/components/ui/problem-alert';
import { useAccess, useLogin } from '@/features/auth/use-auth';
import { problemFrom } from '@/lib/problem';

interface LocationState {
  readonly from?: string;
}

/**
 * Pantalla de acceso del operador (modelo «pega tu token»). El JWT del broker se
 * envía al BFF, que lo valida y lo confina en servidor; el navegador solo recibe
 * la cookie de sesión. En modo abierto o con sesión ya activa, redirige al
 * destino original.
 */
export function LoginPage(): ReactNode {
  const access = useAccess();
  const loginMutation = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState('');

  const from = (location.state as LocationState | null)?.from ?? '/';

  if (access.data === 'authenticated' || access.data === 'open') {
    return <Navigate to={from} replace />;
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = token.trim();
    if (value === '') {
      return;
    }
    loginMutation.mutate(value, { onSuccess: () => navigate(from, { replace: true }) });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Waypoints aria-hidden className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">NexusMQ Console</p>
            <p className="text-xs text-muted-foreground">Acceso de operador</p>
          </div>
        </div>

        <h1 className="text-lg font-semibold text-foreground">Inicia sesión</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Pega tu <strong className="font-medium text-foreground">token de operador</strong> (JWT
          del broker). Se guarda confinado en el servidor; el navegador solo recibe una cookie de
          sesión httpOnly.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="operator-token" className="block text-sm font-medium text-foreground">
              Token de operador
            </label>
            <textarea
              id="operator-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              rows={3}
              autoComplete="off"
              spellCheck={false}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              className="w-full resize-none rounded-lg border border-border bg-page px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-faint-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
            />
          </div>

          {loginMutation.isError && <ProblemAlert problem={problemFrom(loginMutation.error)} />}

          <Button
            type="submit"
            disabled={token.trim() === '' || loginMutation.isPending}
            className="w-full"
          >
            {loginMutation.isPending ? 'Validando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
