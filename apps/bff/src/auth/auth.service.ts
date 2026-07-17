import {
  BadGatewayException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

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

/** Cadencia máxima del barrido de sesiones caducadas (acotada por el propio TTL). */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/** Vigencia de la detección del modo del broker: se re-sondea pasado este tiempo. */
const MODE_CACHE_TTL_MS = 60 * 1000;

/**
 * Auth con **JWT confinado en servidor** (modelo "el operador pega su token").
 *
 * El BFF **no conoce el secreto HS256** del broker: valida el token y descubre
 * si el broker exige auth **sondeando su comportamiento**. El token vive en un
 * almacén en memoria y solo se inyecta, server-side, en las peticiones proxied.
 */
@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);

  /** Almacén de sesiones en memoria (una sola instancia; suficiente para v1). */
  private readonly sessions = new Map<string, OperatorSession>();

  /** Cache del modo del broker: ¿exige auth? Se resuelve por sondeo (lazy) con TTL. */
  private authRequired: boolean | undefined;
  /** Momento de la última detección del modo (para caducar la cache). */
  private authRequiredCheckedAtMs = 0;

  /** Temporizador del barrido periódico de sesiones caducadas. */
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly broker: BrokerService,
    private readonly config: ConfigService,
  ) {}

  /** Arranca el barrido periódico que purga las sesiones caducadas (TTL). */
  onModuleInit(): void {
    const interval = Math.min(this.config.sessionTtlMs, SWEEP_INTERVAL_MS);
    this.sweepTimer = setInterval(() => this.purgeExpired(Date.now()), interval);
    // No debe mantener vivo el proceso por sí solo.
    this.sweepTimer.unref?.();
  }

  /** Detiene el barrido al apagar el módulo (evita fugas del temporizador). */
  onModuleDestroy(): void {
    if (this.sweepTimer !== undefined) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  /** Nº de sesiones activas (útil para diagnóstico y pruebas de arranque). */
  get activeSessionCount(): number {
    return this.sessions.size;
  }

  /** TTL de sesión (ms), para alinear el `maxAge` de la cookie con la caducidad server-side. */
  get sessionTtlMs(): number {
    return this.config.sessionTtlMs;
  }

  /**
   * Elimina las sesiones cuyo TTL ha vencido en `nowMs`. Devuelve cuántas purgó.
   * Lo invoca el barrido periódico y también, de forma perezosa, `resolveToken`.
   */
  purgeExpired(nowMs: number): number {
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (this.isExpired(session, nowMs)) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.logger.log(`Purgadas ${removed} sesión(es) caducada(s).`);
    }
    return removed;
  }

  /** ¿La sesión superó su TTL (creada hace más de `sessionTtlMs`)? */
  private isExpired(session: OperatorSession, nowMs: number): boolean {
    return nowMs - session.createdAtMs >= this.config.sessionTtlMs;
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

  /**
   * Token del broker de la sesión de la cookie, o `undefined` si no hay sesión
   * válida. Aplica el TTL de forma **perezosa**: una sesión caducada se **borra**
   * del almacén y se trata como inexistente (⇒ 401 aguas arriba), sin esperar al
   * barrido periódico.
   */
  resolveToken(cookieHeader: string | undefined): string | undefined {
    const id = this.sessionIdFrom(cookieHeader);
    if (id === undefined) {
      return undefined;
    }
    const session = this.sessions.get(id);
    if (session === undefined) {
      return undefined;
    }
    if (this.isExpired(session, Date.now())) {
      this.sessions.delete(id);
      this.logger.log('Sesión de operador caducada (TTL); purgada.');
      return undefined;
    }
    return session.brokerToken;
  }

  /** ¿Hay una sesión válida detrás de esta cookie? (para `GET /api/auth/session`). */
  isAuthenticated(cookieHeader: string | undefined): boolean {
    return this.resolveToken(cookieHeader) !== undefined;
  }

  /**
   * ¿El broker exige auth? Se sondea **sin token** una ruta protegida: `401/403`
   * ⇒ modo secreto (auth requerida); `2xx` ⇒ modo abierto. El resultado se
   * **cachea con TTL** ({@link MODE_CACHE_TTL_MS}): así, si el broker se reinicia
   * en otro modo, la consola lo **re-detecta** sin reiniciar el BFF.
   */
  async isBrokerAuthRequired(): Promise<boolean> {
    const now = Date.now();
    if (this.authRequired !== undefined && now - this.authRequiredCheckedAtMs < MODE_CACHE_TTL_MS) {
      return this.authRequired;
    }
    const result = await this.broker.forward({ method: 'GET', path: PROBE_PATH, query: { size: 1 } });
    this.authRequired = result.status === 401 || result.status === 403;
    this.authRequiredCheckedAtMs = now;
    return this.authRequired;
  }

  private sessionIdFrom(cookieHeader: string | undefined): string | undefined {
    const raw = readSessionCookie(cookieHeader);
    return raw === undefined ? undefined : verifySignedSessionId(raw, this.config.sessionSecret);
  }
}
