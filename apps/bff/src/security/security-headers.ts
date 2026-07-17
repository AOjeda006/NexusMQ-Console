import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { type INestApplication, Logger } from '@nestjs/common';
import type express from 'express';
import type { NextFunction, Request, Response } from 'express';

import type { ConfigService } from '../config/config.service';

/**
 * Extrae los `<script>` **inline** (sin `src`) de un `index.html` y devuelve sus
 * hashes CSP (`'sha256-…'`). Permite habilitarlos en la CSP sin recurrir a
 * `'unsafe-inline'`, y sin hornear un hash frágil: se calcula del HTML realmente
 * servido, así la política casa siempre con el artefacto desplegado.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const body = match[1] ?? '';
    const digest = createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

/**
 * Construye la Content-Security-Policy. Todo se sirve **desde el mismo origen**
 * (SPA + API + SSE), así que la base es `'self'`. `script-src` añade los hashes
 * de los scripts inline del index; `style-src` admite estilos inline porque las
 * librerías de viz (uPlot/ECharts/react-three-fiber) fijan estilos por atributo.
 */
export function buildCsp(scriptHashes: readonly string[]): string {
  const scriptSrc = ["'self'", ...scriptHashes].join(' ');
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
  ].join('; ');
}

function readIndexHtml(webDistPath: string | undefined): string | undefined {
  if (webDistPath === undefined) {
    return undefined;
  }
  const file = join(resolve(webDistPath), 'index.html');
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

/**
 * Aplica **cabeceras de seguridad** (defensa en profundidad) a todas las
 * respuestas del BFF: CSP (con hash de los scripts inline del index servido),
 * anti-sniff, anti-clickjacking, política de referer, aislamiento de origen y
 * HSTS en producción. Se registra sobre el Express subyacente **antes** que el
 * servido estático y el router de Nest, para cubrir toda respuesta.
 *
 * Mismo origen por diseño: el BFF **no habilita CORS**, así que el navegador
 * bloquea las lecturas cross-origin (no se emite `Access-Control-Allow-Origin`).
 */
export function applySecurityHeaders(app: INestApplication, config: ConfigService): void {
  const instance = app.getHttpAdapter().getInstance() as express.Express;
  // No revelar el framework (fingerprinting).
  instance.disable('x-powered-by');

  const html = readIndexHtml(config.webDistPath);
  const csp = buildCsp(html === undefined ? [] : inlineScriptHashes(html));
  const isProduction = config.isProduction;

  instance.use((_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    // HSTS solo tiene sentido tras TLS (proxy inverso en prod); http lo ignora.
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  new Logger('SecurityHeaders').log(
    `Cabeceras de seguridad activas (CSP con ${html === undefined ? 0 : inlineScriptHashes(html).length} hash(es) inline).`,
  );
}
