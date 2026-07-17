import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type BrokerDouble, startBrokerDouble } from './broker-double';
import { type PrometheusDouble, startPrometheusDouble } from './prometheus-double';

/** Rango/step/ventana válidos (Unix segundos + duraciones Prometheus). */
const RANGE = { start: '1700000000', end: '1700000060', step: '15s', window: '1m' };
const VALID_TOKEN = 'jwt-de-broker-del-operador-1234567890';

/**
 * e2e del data source de Prometheus tras F5.6: `query_range` **exige sesión**
 * (`@Protected`) y **no** acepta PromQL cruda —el cliente elige un id de la
 * **allow-list** y el BFF construye la PromQL en servidor—. Cubre: sin sesión →
 * 401; con sesión y métrica válida → datos; métrica fuera de la allow-list → 400;
 * degradación limpia sin Prometheus; y 502 si Prometheus es inaccesible.
 */
describe('Historia (Prometheus) — configurada, broker en modo secreto (F5.6)', () => {
  let broker: BrokerDouble;
  let prometheus: PrometheusDouble;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    broker = await startBrokerDouble({ requireAuth: true });
    prometheus = await startPrometheusDouble();
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    process.env['PROMETHEUS_URL'] = prometheus.baseUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await prometheus.close();
    await broker.close();
    delete process.env['PROMETHEUS_URL'];
  });

  it('status es abierto e informa que hay historia disponible', async () => {
    const res = await request(app.getHttpServer()).get('/api/history/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true });
  });

  it('query_range sin sesión (broker en modo secreto) responde 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ metric: 'throughput-produce', ...RANGE });

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('con sesión y métrica válida devuelve las series (PromQL construida en servidor)', async () => {
    const login = await agent.post('/api/auth/login').send({ token: VALID_TOKEN });
    expect(login.status).toBe(200);

    const res = await agent
      .get('/api/history/query_range')
      .query({ metric: 'throughput-produce', ...RANGE });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, resultType: 'matrix' });
    expect(res.body.result).toHaveLength(1);
  });

  it('rechaza una métrica fuera de la allow-list con 400 (nada de PromQL cruda)', async () => {
    const res = await agent
      .get('/api/history/query_range')
      .query({ metric: 'sum(rate(secreto[1m]))', ...RANGE });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'Solicitud inválida' });
    expect(res.body.issues[0]).toMatchObject({ path: 'metric' });
  });

  it('rechaza en el borde una petición sin metric', async () => {
    const res = await agent.get('/api/history/query_range').query(RANGE);

    expect(res.status).toBe(400);
    expect(res.body.issues[0]).toMatchObject({ path: 'metric' });
  });

  it('rechaza un step que no es una duración Prometheus (posible inyección)', async () => {
    const res = await agent
      .get('/api/history/query_range')
      .query({ metric: 'errors', start: '1700000000', end: '1700000060', step: '1m]) or 1', window: '1m' });

    expect(res.status).toBe(400);
    expect(res.body.issues[0]).toMatchObject({ path: 'step' });
  });
});

describe('Historia (Prometheus) — no configurada, broker abierto (F5.6)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;

  beforeAll(async () => {
    broker = await startBrokerDouble({ requireAuth: false });
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    delete process.env['PROMETHEUS_URL'];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  it('status informa que la historia no está disponible', async () => {
    const res = await request(app.getHttpServer()).get('/api/history/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  it('query_range degrada limpio (200, available:false) en modo abierto sin sesión', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ metric: 'throughput-produce', ...RANGE });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: false });
    expect(typeof res.body.reason).toBe('string');
  });
});

describe('Historia (Prometheus) — inaccesible, broker abierto (F5.6)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;

  beforeAll(async () => {
    broker = await startBrokerDouble({ requireAuth: false });
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    // Puerto 1: la conexión se rechaza de inmediato ⇒ 502.
    process.env['PROMETHEUS_URL'] = 'http://127.0.0.1:1';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
    delete process.env['PROMETHEUS_URL'];
  });

  it('devuelve 502 problem+json cuando Prometheus no responde (en modo abierto)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/history/query_range')
      .query({ metric: 'throughput-produce', ...RANGE });

    expect(res.status).toBe(502);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'Prometheus inaccesible', status: 502 });
  });
});
