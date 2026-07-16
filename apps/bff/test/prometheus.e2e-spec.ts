import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { BAD_QUERY, type PrometheusDouble, startPrometheusDouble } from './prometheus-double';

const RANGE = { start: '1700000000', end: '1700000060', step: '15s' };

/**
 * e2e del data source de Prometheus (F1.6). Cubre las dos ramas del criterio de
 * aceptación —con y sin Prometheus— más consulta inválida (400 propagado) y
 * Prometheus inaccesible (502).
 */
describe('Historia (Prometheus) — configurado (F1.6)', () => {
  let prometheus: PrometheusDouble;
  let app: INestApplication;

  beforeAll(async () => {
    prometheus = await startPrometheusDouble();
    process.env['PROMETHEUS_URL'] = prometheus.baseUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prometheus.close();
  });

  it('GET /api/history/status informa que hay historia disponible', async () => {
    const res = await request(app.getHttpServer()).get('/api/history/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true });
  });

  it('query_range devuelve las series de Prometheus', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ query: 'nexusmq_messages_in_total', ...RANGE });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, resultType: 'matrix' });
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result).toHaveLength(1);
  });

  it('propaga como 400 una consulta inválida de Prometheus', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ query: BAD_QUERY, ...RANGE });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'Consulta a Prometheus inválida' });
  });

  it('rechaza en el borde una petición sin query', async () => {
    const res = await request(app.getHttpServer()).get('/api/history/query_range').query(RANGE);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ title: 'Solicitud inválida' });
    expect(res.body.issues[0]).toMatchObject({ path: 'query' });
  });
});

describe('Historia (Prometheus) — no configurado (F1.6)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env['PROMETHEUS_URL'];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('status informa que la historia no está disponible', async () => {
    const res = await request(app.getHttpServer()).get('/api/history/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  it('query_range degrada limpio (200, available:false) sin romper', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ query: 'nexusmq_messages_in_total', ...RANGE });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: false });
    expect(typeof res.body.reason).toBe('string');
  });
});

describe('Historia (Prometheus) — inaccesible (F1.6)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Puerto 1: la conexión se rechaza de inmediato ⇒ 502.
    process.env['PROMETHEUS_URL'] = 'http://127.0.0.1:1';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PROMETHEUS_URL'];
  });

  it('devuelve 502 problem+json cuando Prometheus no responde', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ query: 'nexusmq_messages_in_total', ...RANGE });

    expect(res.status).toBe(502);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'Prometheus inaccesible', status: 502 });
  });
});
