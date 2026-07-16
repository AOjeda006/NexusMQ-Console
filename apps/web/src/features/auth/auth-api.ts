import { ProblemError, toProblem } from '@/lib/problem';

/**
 * Endpoints de sesión del BFF. **No** forman parte del contrato del broker (son
 * propios del BFF), así que se llaman con `fetch` directo y no con el cliente
 * tipado. El BFF nunca devuelve el token del broker: el login solo asienta una
 * cookie httpOnly y responde con el estado de autenticación.
 */

/** Estado de sesión que el BFF expone al navegador (lo único que debe saber). */
export interface SessionStatus {
  readonly authenticated: boolean;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }
  throw new ProblemError(toProblem(await safeJson(response), response.status));
}

/** ¿Hay sesión activa? (`GET /api/auth/session`). */
export async function fetchSession(): Promise<SessionStatus> {
  const response = await ensureOk(
    await fetch('/api/auth/session', { headers: { accept: 'application/json' } }),
  );
  return (await response.json()) as SessionStatus;
}

/**
 * Inicia sesión pegando un JWT de operador ya emitido. El BFF lo valida contra
 * el broker y lo confina en servidor; si lo rechaza, `ensureOk` lanza el
 * `ProblemError` (p. ej. 401 «Token rechazado») que la UI muestra.
 */
export async function login(token: string): Promise<void> {
  await ensureOk(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }),
  );
}

/** Cierra la sesión (`POST /api/auth/logout`); idempotente en el BFF. */
export async function logout(): Promise<void> {
  await ensureOk(await fetch('/api/auth/logout', { method: 'POST' }));
}

/**
 * Sondea si el broker exige autenticación pidiendo una ruta protegida sin
 * depender de la sesión: `401/403` ⇒ hay que iniciar sesión (*modo secreto*);
 * `2xx` ⇒ el broker está en *modo abierto* y la consola funciona sin login.
 */
export async function probeAccess(): Promise<'open' | 'locked'> {
  const response = await fetch('/api/v1/topics?size=1', {
    headers: { accept: 'application/json' },
  });
  if (response.status === 401 || response.status === 403) {
    return 'locked';
  }
  await ensureOk(response);
  return 'open';
}
