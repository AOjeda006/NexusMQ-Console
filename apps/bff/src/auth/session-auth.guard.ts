import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { PROTECTED_KEY } from './protected.decorator';

/**
 * Guard **global** por petición. En rutas marcadas con `@Protected()`:
 *
 * - con sesión válida ⇒ inyecta el token confinado en `request.brokerToken` y
 *   deja pasar;
 * - sin sesión y broker en **modo secreto** ⇒ `401` (propio del BFF);
 * - sin sesión y broker en **modo abierto** ⇒ deja pasar sin token.
 *
 * Las rutas públicas (health, observabilidad, `stream`, endpoints de auth) no
 * llevan el marcador y pasan sin tocar el broker.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isProtected = this.reflector.getAllAndOverride<boolean>(PROTECTED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isProtected !== true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.auth.resolveToken(request.headers.cookie);
    if (token !== undefined) {
      request.brokerToken = token;
      return true;
    }

    if (await this.auth.isBrokerAuthRequired()) {
      throw new UnauthorizedException({
        title: 'No autenticado',
        detail: 'Inicia sesión (pega tu token del broker) para operar el broker.',
      });
    }
    return true;
  }
}
