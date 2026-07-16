import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Petición con el **token del broker confinado** que el `SessionAuthGuard`
 * adjunta cuando hay sesión. Vive solo en memoria del proceso durante la
 * petición; nunca se serializa hacia el navegador.
 */
export interface AuthenticatedRequest extends Request {
  brokerToken?: string;
}

/**
 * Inyecta en el handler el token del broker de la sesión actual (o `undefined`
 * en modo abierto). El controller lo pasa a `BrokerService.forward({ token })`;
 * así el token viaja del almacén de sesiones al broker **sin** pasar por el
 * navegador.
 */
export const BrokerToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().brokerToken,
);
