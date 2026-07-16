import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';
import { applyStaticHosting } from '../src/static/static-hosting';

const INDEX_HTML =
  '<!doctype html><html><head><title>NexusMQ Console</title></head><body><div id="root"></div><!--SPA--></body></html>';
const APP_JS = 'console.log("nexusmq spa bundle");';

/** Crea un build de SPA de mentira (index.html + un asset) en un dir temporal. */
function makeWebDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nexusmq-web-'));
  writeFileSync(join(dir, 'index.html'), INDEX_HTML);
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app.js'), APP_JS);
  return dir;
}

describe('Servido de la SPA (F1.7) — con build', () => {
  let app: INestApplication;
  let webDist: string;

  beforeAll(async () => {
    webDist = makeWebDist();
    process.env['WEB_DIST_PATH'] = webDist;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyStaticHosting(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env['WEB_DIST_PATH'];
    rmSync(webDist, { recursive: true, force: true });
  });

  it('sirve index.html en /', async () => {
    const res = await request(app.getHttpServer()).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<!--SPA-->');
  });

  it('sirve los assets reales del build', async () => {
    const res = await request(app.getHttpServer()).get('/assets/app.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('nexusmq spa bundle');
  });

  it('hace fallback a index.html en rutas de cliente (deep link)', async () => {
    const res = await request(app.getHttpServer()).get('/topics/ventas');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<!--SPA-->');
  });

  it('no tapa la API: /health sigue devolviendo JSON', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('no sirve la SPA en rutas de API desconocidas (404 problem+json)', async () => {
    const res = await request(app.getHttpServer()).get('/api/desconocida');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});

describe('Servido de la SPA (F1.7) — sin build', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env['WEB_DIST_PATH'];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    applyStaticHosting(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin WEB_DIST_PATH no sirve la SPA: / responde 404', async () => {
    const res = await request(app.getHttpServer()).get('/');

    expect(res.status).toBe(404);
  });

  it('la API sigue disponible', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});
