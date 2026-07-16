import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { BrokerUnreachableError } from '../broker/broker.service';
import { buildProblem, type ProblemDocument, type ProblemIssue } from './problem-details';

/**
 * Filtro global que traduce **cualquier** error no capturado a un documento
 * `application/problem+json` (RFC 7807). Cubre los errores que **origina el
 * BFF**: validación en el borde (`HttpException` 4xx) y broker inaccesible
 * (`BrokerUnreachableError` → 502). Los errores que ya devuelve el broker se
 * reemiten *verbatim* en los controllers y **no** pasan por aquí.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = this.toProblem(exception);
    response.status(problem.status).type('application/problem+json').send(problem);
  }

  private toProblem(exception: unknown): ProblemDocument {
    if (exception instanceof BrokerUnreachableError) {
      this.logger.warn(exception.message);
      return buildProblem({
        status: HttpStatus.BAD_GATEWAY,
        title: 'Broker inaccesible',
        detail: 'El BFF no pudo contactar con el broker NexusMQ.',
      });
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    const message = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(message);
    return buildProblem({ status: HttpStatus.INTERNAL_SERVER_ERROR, title: 'Error interno' });
  }

  private fromHttpException(exception: HttpException): ProblemDocument {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return buildProblem({ status, title: payload });
    }

    const record = payload as Record<string, unknown>;
    return buildProblem({
      status,
      title: this.resolveTitle(record, exception.message),
      detail: typeof record['detail'] === 'string' ? record['detail'] : undefined,
      issues: this.extractIssues(record['issues']),
    });
  }

  private resolveTitle(record: Record<string, unknown>, fallback: string): string {
    if (typeof record['title'] === 'string') {
      return record['title'];
    }
    if (typeof record['error'] === 'string') {
      return record['error'];
    }
    return fallback;
  }

  private extractIssues(value: unknown): ProblemIssue[] | undefined {
    // Los issues llegan ya con forma { path, message } desde ZodValidationPipe.
    return Array.isArray(value) ? (value as ProblemIssue[]) : undefined;
  }
}
