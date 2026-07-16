/** Un problema de validación puntual (una propiedad y su mensaje). */
export interface ProblemIssue {
  readonly path: string;
  readonly message: string;
}

/** Documento de error según **RFC 7807** (`application/problem+json`). */
export interface ProblemDocument {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly issues?: readonly ProblemIssue[];
}

/** Entrada para {@link buildProblem} (todo salvo `type`, que tiene default). */
export interface BuildProblemInput {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly issues?: readonly ProblemIssue[];
  readonly type?: string;
}

/**
 * Construye un {@link ProblemDocument} con `type` por defecto `about:blank`.
 * Las claves opcionales sin valor se omiten al serializar (JSON.stringify).
 */
export function buildProblem(input: BuildProblemInput): ProblemDocument {
  return {
    type: input.type ?? 'about:blank',
    title: input.title,
    status: input.status,
    detail: input.detail,
    instance: input.instance,
    issues: input.issues,
  };
}
