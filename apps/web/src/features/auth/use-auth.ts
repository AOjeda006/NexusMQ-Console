import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { fetchSession, login, logout, probeAccess } from './auth-api';

/**
 * Estado de acceso derivado, que unifica sesión y modo del broker:
 * - `authenticated`: hay sesión de operador activa.
 * - `open`: el broker no exige auth; la consola funciona sin login.
 * - `locked`: el broker exige auth y no hay sesión ⇒ hay que iniciar sesión.
 */
export type AccessState = 'authenticated' | 'open' | 'locked';

/** Clave de caché del estado de acceso. */
export const accessQueryKey = ['access'] as const;

async function resolveAccess(): Promise<AccessState> {
  const session = await fetchSession();
  if (session.authenticated) {
    return 'authenticated';
  }
  return probeAccess();
}

/**
 * Resuelve el estado de acceso (sesión + modo del broker). Es la base del guard
 * de rutas y del indicador de conexión. Se refresca con poca frecuencia: el modo
 * del broker no cambia en caliente y la sesión se invalida explícitamente al
 * hacer login/logout.
 */
export function useAccess(): UseQueryResult<AccessState, Error> {
  return useQuery({
    queryKey: accessQueryKey,
    queryFn: resolveAccess,
    staleTime: 30_000,
  });
}

/**
 * Login del operador. Al completarse, invalida toda la caché para que el estado
 * de acceso y las vistas de datos se recarguen ya con sesión.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => login(token),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Logout del operador; invalida la caché para volver al estado sin sesión. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
