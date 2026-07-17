import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type BrokerDouble, INVALID_TOKEN, startBrokerDouble } from './broker-double';

/** Token que el doble (en modo secreto) acepta como válido. */
const VALID_TOKEN = 'jwt-de-broker-del-operador-1234567890';

/**
 * e2e de auth con **JWT confinado** (F1.4). Verifica el flujo login/logout, el
 * guard por petición (401 sin sesión en modo secreto), el **modo abierto** (sin
 * login cuando el broker no exige auth) y —criterio de aceptación clave— que el
 * token del broker **nunca** aparece en una respuesta al navegador.
 */
describe('Auth — broker en modo secreto (F1.4)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    broker = await startBrokerDouble({ requireAuth: true });
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  it('rechaza una ruta protegida sin sesión con 401 (BFF)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/topics');

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'No autenticado', status: 401 });
  });

  it('protege metrics/snapshot: sin sesión responde 401 (fuga en modo secreto, F5.7)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics/snapshot');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ title: 'No autenticado', status: 401 });
  });

  it('rechaza el login si el broker no acepta el token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ token: INVALID_TOKEN });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.text).not.toContain(INVALID_TOKEN);
  });

  it('acepta el login válido: cookie httpOnly y el token no viaja al navegador', async () => {
    const res = await agent.post('/api/auth/login').send({ token: VALID_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: true });

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const sessionCookie = setCookie.find((cookie) => cookie.startsWith('nexusmq_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    // El token del broker NO aparece: ni en el cuerpo ni en la cookie de sesión.
    expect(res.text).not.toContain(VALID_TOKEN);
    expect(sessionCookie).not.toContain(VALID_TOKEN);
  });

  it('con sesión, el proxy funciona y el token no aparece en la respuesta', async () => {
    const res = await agent.get('/api/v1/topics?size=5');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ size: 5 });
    expect(res.text).not.toContain(VALID_TOKEN);
    expect(JSON.stringify(res.headers)).not.toContain(VALID_TOKEN);
  });

  it('GET /api/auth/session refleja el estado de autenticación', async () => {
    const authed = await agent.get('/api/auth/session');
    expect(authed.body).toEqual({ authenticated: true });

    const anon = await request(app.getHttpServer()).get('/api/auth/session');
    expect(anon.body).toEqual({ authenticated: false });
  });

  it('logout cierra la sesión y vuelve a proteger el proxy', async () => {
    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ authenticated: false });

    const after = await agent.get('/api/v1/topics');
    expect(after.status).toBe(401);
  });
});

describe('Auth — broker en modo abierto (F1.4)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;

  beforeAll(async () => {
    broker = await startBrokerDouble({ requireAuth: false });
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  it('permite operar sin sesión cuando el broker no exige auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/topics');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, size: 20 });
  });
});

/**
 * Gate de login (F5.7): con `CONSOLE_REQUIRE_LOGIN=true`, la consola exige sesión
 * **siempre**, aunque el broker esté en **modo abierto**. Contrasta con el modo
 * abierto de arriba (gate inactivo), que sí deja operar sin login.
 */
describe('Auth — gate de login activo, broker abierto (F5.7)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    broker = await startBrokerDouble({ requireAuth: false });
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    process.env['CONSOLE_REQUIRE_LOGIN'] = 'true';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
    process.env['CONSOLE_REQUIRE_LOGIN'] = 'false';
  });

  it('exige sesión aunque el broker esté abierto: topics sin sesión → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/topics');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ title: 'No autenticado', status: 401 });
  });

  it('metrics/snapshot sin sesión → 401 (aunque el broker esté abierto)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics/snapshot');

    expect(res.status).toBe(401);
  });

  it('tras iniciar sesión, opera con normalidad (topics y snapshot)', async () => {
    const login = await agent.post('/api/auth/login').send({ token: VALID_TOKEN });
    expect(login.status).toBe(200);

    const topics = await agent.get('/api/v1/topics');
    expect(topics.status).toBe(200);

    const snapshot = await agent.get('/api/v1/metrics/snapshot');
    expect(snapshot.status).toBe(200);
  });
});
