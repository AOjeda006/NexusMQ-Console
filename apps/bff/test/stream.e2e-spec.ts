import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { get as httpGet, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type BrokerDouble, startBrokerDouble } from './broker-double';

/**
 * e2e de la terminación SSE (F1.5). `supertest` bufferiza la respuesta completa,
 * inservible para un stream sin fin; usamos un cliente SSE crudo sobre
 * `node:http` y aserciones por sondeo.
 */
interface SseClient {
  readonly response: IncomingMessage;
  metricsFrames(): number;
  ended(): boolean;
  close(): void;
}

function connectSse(port: number): Promise<SseClient> {
  return new Promise((resolve, reject) => {
    const request = httpGet({ host: '127.0.0.1', port, path: '/api/v1/stream' }, (response) => {
      let buffer = '';
      let ended = false;
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        buffer += chunk;
      });
      response.on('end', () => {
        ended = true;
      });
      resolve({
        response,
        metricsFrames: () => (buffer.match(/event: metrics/g) ?? []).length,
        ended: () => ended,
        close: () => request.destroy(),
      });
    });
    request.on('error', reject);
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('timeout esperando la condición del stream');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function listen(app: INestApplication): Promise<number> {
  await app.init();
  const server = app.getHttpServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

describe('Terminación SSE — reemisión de frames (F1.5)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    broker = await startBrokerDouble();
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    port = await listen(app);
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  it('reexpone el SSE del broker al navegador', async () => {
    const client = await connectSse(port);
    try {
      expect(client.response.statusCode).toBe(200);
      expect(client.response.headers['content-type']).toContain('text/event-stream');
      await waitUntil(() => client.metricsFrames() >= 2, 4000);
    } finally {
      client.close();
    }
  }, 10_000);
});

describe('Terminación SSE — reconexión sin tumbar al cliente (F1.5)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    broker = await startBrokerDouble({ streamCloseAfterFirstFrame: true });
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    port = await listen(app);
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  it('reconecta al broker manteniendo viva la conexión del navegador', async () => {
    const client = await connectSse(port);
    try {
      // El broker cierra tras cada frame: recibir ≥2 frames exige que el BFF
      // haya reconectado, sin que el navegador note un corte.
      await waitUntil(() => client.metricsFrames() >= 2, 6000);
      expect(client.ended()).toBe(false);
      expect(broker.streamConnectionCount()).toBeGreaterThanOrEqual(2);
    } finally {
      client.close();
    }
  }, 12_000);
});

describe('Terminación SSE — cierre limpio al desconectar el cliente (F1.5)', () => {
  let broker: BrokerDouble;
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    broker = await startBrokerDouble();
    process.env['BROKER_ADMIN_URL'] = broker.baseUrl;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    port = await listen(app);
  });

  afterAll(async () => {
    await app.close();
    await broker.close();
  });

  it('aborta el upstream cuando el navegador se desconecta', async () => {
    const client = await connectSse(port);
    await waitUntil(() => client.metricsFrames() >= 1, 4000);
    expect(broker.openStreamCount()).toBe(1);

    client.close();

    await waitUntil(() => broker.openStreamCount() === 0, 4000);
    expect(broker.openStreamCount()).toBe(0);
  }, 10_000);
});
