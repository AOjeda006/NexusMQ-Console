import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import type { ProblemIssue } from './problem-details';

/**
 * Pipe de **validación en el borde**: parsea el valor con un esquema Zod y, si
 * falla, lanza `BadRequestException` con el detalle por propiedad. El
 * `ProblemDetailsFilter` traduce esa excepción a `application/problem+json`
 * (RFC 7807) con `status: 400`.
 *
 * Se usa por parámetro (`@Query(pipe)`, `@Body(pipe)`, `@Param(pipe)`) para no
 * acoplar el pipe a un DTO global y mantener los controllers finos.
 */
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    const issues: ProblemIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(raíz)',
      message: issue.message,
    }));

    throw new BadRequestException({ title: 'Solicitud inválida', issues });
  }
}
