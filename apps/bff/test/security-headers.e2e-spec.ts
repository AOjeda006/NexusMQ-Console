import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';
import { applySecurityHeaders } from '../src/security/security-headers';
import { applyStaticHosting } from '../src/static/static-hosting';

const INLINE_SCRIPT = 'window.__nexusmq_theme=1;';
const INDEX_HTML = `<!doctype html><html><head><script>${INLINE_SCRIPT}</script></head><body><div id="root"></div></body></html>`;
const EXPECTED_HASH = `'sha256-${createHash('sha256').update(INLINE_SCRIPT, 'utf8').digest('base64')}'`;

function makeWebDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nexusmq-sec-'));
  writeFileSync(join(dir, 'index.html'), INDEX_HTML);
  return dir;
}

/**
 * E2E de las **cabeceras de seguridad** (F4.3). Verifica que el BFF endurece
 * toda respuesta (SPA + API), que la CSP permite el script inline del index por
 * su hash (sin `unsafe-inline`) y que no revela el framework.
 */
describe('Cabeceras de seguridad (F4.3)', () => {
  let app: INestApplication;
  let webDist: string;

  beforeAll(async () => {
    webDist = makeWebDist();
    process.env['WEB_DIST_PATH'] = webDist;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applySecurityHeaders(app, app.get(ConfigService));
    applyStaticHosting(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env['WEB_DIST_PATH'];
    rmSync(webDist, { recursive: true, force: true });
  });

  it('endurece la respuesta de la SPA con CSP y demás cabeceras', async () => {
    const res = await request(app.getHttpServer()).get('/');

    const csp = res.headers['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    // script-src habilita el inline del index por su HASH, sin `unsafe-inline`.
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).toContain(EXPECTED_HASH);
    expect(scriptSrc).not.toContain('unsafe-inline');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('aplica las cabeceras también a la API (no solo a la SPA)', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('no emite HSTS fuera de producción (http lo ignoraría)', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});
