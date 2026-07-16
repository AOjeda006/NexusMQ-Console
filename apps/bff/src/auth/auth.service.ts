import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { BrokerService } from '../broker/broker.service';
import { ConfigService } from '../config/config.service';
import {
  createSessionId,
  readSessionCookie,
  signSessionId,
  verifySignedSessionId,
} from './session-cookie';

/**
 * Sesión de operador. Guarda **en servidor** el JWT del broker que el operador
 * pegó en el login; al navegador solo viaja el `id` (en una cookie httpOnly). El
 * `brokerToken` **nunca** sale del BFF.
 */
export interface OperatorSession {
  readonly id: string;
  readonly brokerToken: string;
  readonly createdAtMs: number;
}

/** Endpoint protegido barato que sirve para validar tokens y sondear el modo. */
const PROBE_PATH = '/api/v1/topics';

/**
 * Auth con **JWT confinado en servidor** (modelo "el operador pega su token").
 *
 * El BFF **no conoce el secreto HS256** del broker: valida el token y descubre
 * si el broker exige auth **sondeando su comportamiento**. El token vive en un
 * almacén en memoria y solo se inyecta, server-side, en las peticiones proxied.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Almacén de sesiones en memoria (una sola instancia; suficiente para v1). */
  private readonly sessions = new Map<string, OperatorSession>();

  /** Cache del modo del broker: ¿exige auth? Se resuelve por sondeo (lazy). */
  private authRequired: boolean | undefined;

  constructor(
    private readonly broker: BrokerService,
    private readonly config: ConfigService,
  ) {}

  /** Nº de sesiones activas (útil para diagnóstico y pruebas de arranque). */
  get activeSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Valida el token pegado contra el broker y crea sesión. Devuelve el valor
   * **firmado** para la cookie. Si el broker rechaza el token (401/403), lanza
   * `UnauthorizedException`; si el broker falla (≥500), `BadGatewayException`.
   */
  async login(token: string): Promise<string> {
    const result = await this.broker.forward({
      method: 'GET',
      path: PROBE_PATH,
      query: { size: 1 },
      token,
    });

    if (result.status === 401 || result.status === 403) {
      throw new UnauthorizedException({
        title: 'Token rechazado',
        detail: 'El broker no aceptó el token proporcionado.',
      });
    }
    if (result.status >= 500) {
      throw new BadGatewayException({ title: 'Broker no disponible' });
    }

    const session: OperatorSession = {
      id: createSessionId(),
      brokerToken: token,
      createdAtMs: Date.now(),
    };
    this.sessions.set(session.id, session);
    this.logger.log('Sesión de operador creada.');

    return signSessionId(session.id, this.config.sessionSecret);
  }

  /** Cierra la sesión asociada a la cookie (idempotente). */
  logout(cookieHeader: string | undefined): void {
    const id = this.sessionIdFrom(cookieHeader);
    if (id !== undefined && this.sessions.delete(id)) {
      this.logger.log('Sesión de operador cerrada.');
    }
  }

  /** Token del broker de la sesión de la cookie, o `undefined` si no hay sesión válida. */
  resolveToken(cookieHeader: string | undefined): string | undefined {
    const id = this.sessionIdFrom(cookieHeader);
    return id === undefined ? undefined : this.sessions.get(id)?.brokerToken;
  }

  /** ¿Hay una sesión válida detrás de esta cookie? (para `GET /api/auth/session`). */
  isAuthenticated(cookieHeader: string | undefined): boolean {
    return this.resolveToken(cookieHeader) !== undefined;
  }

  /**
   * ¿El broker exige auth? Se sondea **sin token** una ruta protegida: `401/403`
   * ⇒ modo secreto (auth requerida); `2xx` ⇒ modo abierto. El resultado se
   * cachea (el modo del broker no cambia en caliente).
   */
  async isBrokerAuthRequired(): Promise<boolean> {
    if (this.authRequired !== undefined) {
      return this.authRequired;
    }
    const result = await this.broker.forward({ method: 'GET', path: PROBE_PATH, query: { size: 1 } });
    this.authRequired = result.status === 401 || result.status === 403;
    return this.authRequired;
  }

  private sessionIdFrom(cookieHeader: string | undefined): string | undefined {
    const raw = readSessionCookie(cookieHeader);
    return raw === undefined ? undefined : verifySignedSessionId(raw, this.config.sessionSecret);
  }
}
