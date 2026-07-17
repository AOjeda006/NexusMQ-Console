import type { components } from '@nexusmq/contract';

/**
 * Detalle de error RFC 7807 tal cual lo define el contrato de NexusMQ. Tanto el
 * broker como el BFF emiten `application/problem+json` con esta forma, así que la
 * consola tiene un único modelo de error de extremo a extremo. **No se escribe a
 * mano**: sale del contrato generado.
 */
export type ProblemDetail = components['schemas']['ProblemDetail'];

/**
 * Error de dominio de la consola: envuelve un {@link ProblemDetail} para que
 * cualquier capa (TanStack Query, componentes) lo trate de forma uniforme. El
 * `message` prioriza el `detail` legible y cae al `title`.
 */
export class ProblemError extends Error {
  readonly problem: ProblemDetail;

  constructor(problem: ProblemDetail) {
    super(problem.detail ?? problem.title);
    this.name = 'ProblemError';
    this.problem = problem;
  }

  /** Código HTTP asociado (0 si el fallo es de red y no hubo respuesta). */
  get status(): number {
    return this.problem.status;
  }
}

function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate['title'] === 'string' && typeof candidate['status'] === 'number';
}

/**
 * Normaliza un cuerpo de error (posible `problem+json`) a {@link ProblemDetail}.
 * Si no tiene la forma esperada (respuesta opaca, error de red), sintetiza uno
 * con el status recibido para que la UI siempre tenga algo coherente que mostrar.
 */
export function toProblem(body: unknown, fallbackStatus: number): ProblemDetail {
  if (isProblemDetail(body)) {
    return body;
  }
  return {
    type: 'about:blank',
    title: fallbackStatus === 0 ? 'No se pudo contactar con el servidor' : 'Error inesperado',
    status: fallbackStatus,
  };
}

/**
 * Extrae un {@link ProblemDetail} de cualquier error capturado por TanStack
 * Query (que lo tipa como `Error`). Si ya es un {@link ProblemError} usa su
 * problema; si es otro `Error`, sintetiza uno con su mensaje.
 */
export function problemFrom(error: unknown): ProblemDetail {
  if (error instanceof ProblemError) {
    return error.problem;
  }
  if (error instanceof Error) {
    return { type: 'about:blank', title: error.message || 'Error inesperado', status: 0 };
  }
  return toProblem(error, 0);
}

/** Resultado crudo de una llamada `openapi-fetch` (data XOR error + respuesta). */
export interface FetchResult<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

/**
 * Devuelve los datos de un resultado `openapi-fetch` o lanza un
 * {@link ProblemError} normalizado. Es el único punto donde un error del
 * contrato se convierte en excepción para TanStack Query.
 */
export function unwrap<T>(result: FetchResult<T>): T {
  if (result.data !== undefined) {
    return result.data;
  }
  throw new ProblemError(toProblem(result.error, result.response.status));
}

/**
 * Variante para respuestas **sin cuerpo** (p. ej. `204 No Content` de un
 * `DELETE`): no hay `data` que devolver, así que solo se comprueba el estado y se
 * lanza un {@link ProblemError} si el broker/BFF respondió con error.
 */
export function unwrapVoid(result: Pick<FetchResult<unknown>, 'error' | 'response'>): void {
  if (!result.response.ok) {
    throw new ProblemError(toProblem(result.error, result.response.status));
  }
}
