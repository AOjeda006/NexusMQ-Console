import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { ProblemError } from '@/lib/problem';

/**
 * Crea el `QueryClient` con la política de reintentos de la consola: los errores
 * de cliente (4xx, p. ej. 401 sin sesión o 404) **no** se reintentan —son
 * deterministas—; los fallos transitorios (red, 5xx) se reintentan un par de
 * veces con el backoff por defecto de TanStack Query.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ProblemError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        staleTime: 5_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Provee el `QueryClient` a toda la app. Se crea una sola vez por montaje (vía
 * `useState`) para que sobreviva a los re-render sin recrearse.
 */
export function QueryProvider({ children }: { children: ReactNode }): ReactNode {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
