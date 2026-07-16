import type { Response } from 'express';

import type { ProxyResult } from '../broker/broker.service';

/**
 * Reemite *verbatim* al navegador la respuesta que dio el broker: mismo status,
 * mismo `Content-Type` (incluido `application/problem+json` en los 4xx/5xx) y
 * mismo cuerpo. Propaga `Location` cuando el broker lo envía (p. ej. `201` al
 * crear un topic). Así el BFF es un proxy transparente del plano de operación.
 */
export function sendProxyResult(response: Response, result: ProxyResult): void {
  if (result.location !== undefined) {
    response.setHeader('Location', result.location);
  }
  if (result.contentType !== undefined) {
    response.type(result.contentType);
  }
  response.status(result.status).send(result.body);
}
