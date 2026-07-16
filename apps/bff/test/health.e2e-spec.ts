import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';

describe('BFF · arranque (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('compone el árbol de módulos y arranca sin errores de DI', () => {
    expect(app).toBeDefined();
  });

  it('GET /health responde 200 con el estado del BFF', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok', service: '@nexusmq/bff' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });
});
