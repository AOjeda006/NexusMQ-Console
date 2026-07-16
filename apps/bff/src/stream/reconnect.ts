/** Backoff exponencial con *jitter* y tope, para reconectar sin tormentas. */
export interface BackoffOptions {
  readonly initialMs: number;
  readonly maxMs: number;
}

/**
 * Retardo del intento `attempt` (0-based): exponencial `initial·2^attempt`
 * acotado a `maxMs`, con *jitter* en la mitad inferior del intervalo. El jitter
 * evita que muchos clientes reconecten a la vez (*thundering herd*).
 */
export function backoffDelayMs(attempt: number, options: BackoffOptions): number {
  const exponential = Math.min(options.maxMs, options.initialMs * 2 ** attempt);
  const half = exponential / 2;
  return Math.round(half + Math.random() * half);
}

/**
 * Espera `ms` de forma cancelable. Resuelve `true` si transcurrió el tiempo,
 * `false` si la señal abortó antes (para salir del bucle de reconexión limpio).
 */
export function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
