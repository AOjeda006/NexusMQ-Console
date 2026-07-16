import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { CookieOptions } from 'express';

/** Nombre de la cookie de sesión httpOnly del BFF. */
export const SESSION_COOKIE_NAME = 'nexusmq_session';

/** Vida de la sesión: 8 h. Tras expirar, el operador vuelve a pegar su token. */
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/** Id de sesión opaco e imposible de adivinar (256 bits de aleatoriedad). */
export function createSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Firma el id con `HMAC-SHA256(id, SESSION_SECRET)` y devuelve `id.firma`. La
 * cookie no transporta datos —solo la clave de sesión—, pero la firma permite
 * **descartar cookies manipuladas** antes de tocar el almacén.
 */
export function signSessionId(id: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(id).digest('base64url');
  return `${id}.${signature}`;
}

/** Verifica la firma (tiempo constante) y devuelve el id, o `undefined` si no cuadra. */
export function verifySignedSessionId(value: string, secret: string): string | undefined {
  const dot = value.lastIndexOf('.');
  if (dot <= 0) {
    return undefined;
  }

  const id = value.slice(0, dot);
  const provided = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(createHmac('sha256', secret).update(id).digest('base64url'));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return undefined;
  }
  return id;
}

/**
 * Extrae el valor (firmado) de la cookie de sesión de la cabecera `Cookie`, sin
 * depender de `cookie-parser`: basta un parseo mínimo para leer nuestra clave.
 */
export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/** Opciones de la cookie de sesión: httpOnly, `SameSite=Lax` y `Secure` en prod. */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  };
}
