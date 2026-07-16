import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type BrokerDouble, startBrokerDouble } from './broker-double';

/**
 * e2e del proxy REST (F1.3) contra el {@link startBrokerDouble doble del broker}.
 * Cubre, por endpoint: passthrough de éxito, passthrough de error 4xx del broker
 * (RFC 7807 intacto), validación en el borde (400 originado por el BFF) y broker
 * inaccesible (502).
 */
describe('Proxy REST del broker (F1.3)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;

  beforeAll(async () => {
    broker = await startBrokerDouble();
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  describe('passthrough de éxito', () => {
    it('GET /healthz reexpone la salud del broker', async () => {
      const res = await request(app.getHttpServer()).get('/healthz');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });

    it('GET /readyz reexpone la preparación del broker', async () => {
      const res = await request(app.getHttpServer()).get('/readyz');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ready' });
    });

    it('GET /api/v1/metrics/snapshot reexpone el snapshot', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/metrics/snapshot');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('generatedAtMs');
    });

    it('GET /api/v1/topics propaga la paginación al broker', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/topics?page=3&size=50');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 3, size: 50 });
    });

    it('GET /api/v1/topics aplica los defaults de paginación', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/topics');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, size: 20 });
    });

    it('POST /api/v1/topics crea y propaga la cabecera Location', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/topics')
        .send({ name: 'nuevo', partitionCount: 3 });

      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe('/api/v1/topics/nuevo');
      expect(res.body).toMatchObject({ name: 'nuevo' });
    });

    it('GET /api/v1/topics/:name describe un topic', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/topics/ventas');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'ventas' });
    });

    it('PATCH /api/v1/topics/:name altera la retención', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/topics/ventas')
        .send({ retentionMs: 60_000 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'ventas' });
    });

    it('DELETE /api/v1/topics/:name borra sin contenido (204)', async () => {
      const res = await request(app.getHttpServer()).delete('/api/v1/topics/ventas');

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('GET /api/v1/groups propaga la paginación', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/groups?page=2&size=10');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 2, size: 10 });
    });

    it('GET /api/v1/groups/:id describe un grupo', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/groups/analitica');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'analitica' });
    });

    it('GET /api/v1/cluster reexpone el estado del clúster', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/cluster');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ nodeId: 1 });
    });
  });

  describe('passthrough de error 4xx del broker (RFC 7807 intacto)', () => {
    it('propaga el 404 de un topic inexistente', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/topics/inexistente');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ title: 'Topic no encontrado', status: 404 });
    });

    it('propaga el 409 al crear un topic ya existente', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/topics')
        .send({ name: 'existente' });

      expect(res.status).toBe(409);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 409 });
    });

    it('propaga el 404 de un grupo inexistente', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/groups/inexistente');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 404 });
    });
  });

  describe('validación en el borde (400 originado por el BFF)', () => {
    it('rechaza size fuera de rango sin llegar al broker', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/topics?size=500');

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ title: 'Solicitud inválida' });
      expect(Array.isArray(res.body.issues)).toBe(true);
    });

    it('rechaza crear un topic sin nombre', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/topics').send({});

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.issues[0]).toMatchObject({ path: 'name' });
    });

    it('rechaza PATCH con segmentBytes (create-only)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/topics/ventas')
        .send({ segmentBytes: 1024 });

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ title: 'Solicitud inválida' });
    });
  });
});

describe('Proxy REST — broker inaccesible (502)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Puerto 1: la conexión se rechaza de inmediato ⇒ BrokerUnreachableError.
    process.env['BROKER_ADMIN_URL'] = 'http://127.0.0.1:1';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve 502 problem+json cuando el broker no responde', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/topics/ventas');

    expect(res.status).toBe(502);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'Broker inaccesible', status: 502 });
  });
});
