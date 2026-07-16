import { Injectable } from '@nestjs/common';

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

/**
 * Auth con **JWT confinado en servidor** (modelo "el operador pega su token").
 *
 * @remarks
 * En **F1.4** implementa login (valida el token contra el broker y crea sesión),
 * logout y el guard por petición que adjunta el token a los proxies. Aquí queda
 * el almacén de sesiones en memoria que materializa el confinamiento.
 */
@Injectable()
export class AuthService {
  /** Almacén de sesiones en memoria (una sola instancia; suficiente para v1). */
  private readonly sessions = new Map<string, OperatorSession>();

  /** Nº de sesiones activas (útil para diagnóstico y pruebas de arranque). */
  get activeSessionCount(): number {
    return this.sessions.size;
  }
}
