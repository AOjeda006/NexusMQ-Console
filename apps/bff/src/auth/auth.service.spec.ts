import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrokerService } from '../broker/broker.service';
import type { ConfigService } from '../config/config.service';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME } from './session-cookie';

const SECRET = 'a'.repeat(40);

/** AuthService con un broker que acepta el login (200) y un TTL configurable. */
function makeAuth(ttlMs: number): AuthService {
  const broker = {
    forward: vi.fn().mockResolvedValue({ status: 200, headers: {}, body: '' }),
  } as unknown as BrokerService;
  const config = { sessionSecret: SECRET, sessionTtlMs: ttlMs } as unknown as ConfigService;
  return new AuthService(broker, config);
}

function cookieHeaderFrom(signed: string): string {
  return `${SESSION_COOKIE_NAME}=${signed}`;
}

describe('AuthService — TTL y purga de sesiones (F5.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('una sesión fresca resuelve su token; vencido el TTL da 401 y sale del Map', async () => {
    const auth = makeAuth(1000);
    const cookie = cookieHeaderFrom(await auth.login('broker-token'));

    expect(auth.resolveToken(cookie)).toBe('broker-token');
    expect(auth.activeSessionCount).toBe(1);

    vi.setSystemTime(1000); // alcanza el TTL (comparación `>=`)
    expect(auth.resolveToken(cookie)).toBeUndefined();
    expect(auth.activeSessionCount).toBe(0); // purgada perezosamente del almacén
  });

  it('isAuthenticated respeta el TTL', async () => {
    const auth = makeAuth(1000);
    const cookie = cookieHeaderFrom(await auth.login('tok'));

    expect(auth.isAuthenticated(cookie)).toBe(true);
    vi.setSystemTime(1500);
    expect(auth.isAuthenticated(cookie)).toBe(false);
  });

  it('purgeExpired elimina solo las caducadas y devuelve el conteo', async () => {
    const auth = makeAuth(1000);
    await auth.login('a');
    await auth.login('b');

    expect(auth.purgeExpired(500)).toBe(0); // ambas vivas
    expect(auth.activeSessionCount).toBe(2);
    expect(auth.purgeExpired(2000)).toBe(2); // ambas caducadas
    expect(auth.activeSessionCount).toBe(0);
  });

  it('el barrido periódico purga las sesiones caducadas sin dejar crecer el Map', async () => {
    const auth = makeAuth(1000);
    await auth.login('old');
    auth.onModuleInit(); // arranca el intervalo (min(TTL, cadencia) = 1000 ms)
    expect(auth.activeSessionCount).toBe(1);

    vi.advanceTimersByTime(1000); // dispara el barrido en t=1000: la sesión (creada en t=0) caduca
    expect(auth.activeSessionCount).toBe(0);

    auth.onModuleDestroy();
  });
});
