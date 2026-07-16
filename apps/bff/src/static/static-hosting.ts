import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { type INestApplication, Logger } from '@nestjs/common';
import express, { type NextFunction, type Request, type Response } from 'express';

import type { ConfigService } from '../config/config.service';

/** Rutas propias del BFF (API + observabilidad): nunca devuelven la SPA. */
function isBffRoute(path: string): boolean {
  return (
    path.startsWith('/api/') || path === '/health' || path === '/healthz' || path === '/readyz'
  );
}

/**
 * En producción el BFF sirve el build estático de la SPA (`apps/web`) en el
 * mismo origen: entrega los ficheros reales y hace **fallback** a `index.html`
 * en las rutas de cliente (SPA routing), **sin tapar** las rutas de API ni de
 * observabilidad.
 *
 * Se activa solo si `WEB_DIST_PATH` apunta a un directorio con `index.html`; si
 * no, es un *no-op* (en desarrollo, la SPA la sirve Vite). Se aplica como
 * middleware del Express subyacente **antes** del router de Nest.
 */
export function applyStaticHosting(app: INestApplication, config: ConfigService): void {
  const logger = new Logger('StaticHosting');
  const dir = config.webDistPath;
  if (dir === undefined) {
    return;
  }

  const root = resolve(dir);
  const indexHtml = join(root, 'index.html');
  if (!existsSync(indexHtml)) {
    logger.warn(`WEB_DIST_PATH=${dir} no contiene index.html; no se sirve la SPA.`);
    return;
  }

  const instance = app.getHttpAdapter().getInstance() as express.Express;

  // 1) Ficheros reales del build (JS/CSS/assets). `fallthrough` ⇒ si no existe,
  //    sigue hacia el router (API) o hacia el fallback de la SPA.
  instance.use(express.static(root, { index: false, fallthrough: true }));

  // 2) Fallback SPA: las GET que no son de API/observabilidad devuelven la app,
  //    para que el enrutado de cliente (deep links) funcione al recargar.
  instance.use((req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' || isBffRoute(req.path)) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });

  logger.log(`Sirviendo la SPA desde ${root}`);
}
