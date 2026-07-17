import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * **Doble del broker NexusMQ** para los e2e del proxy (F1.3). Es un servidor
 * HTTP mínimo y determinista que imita el plano de operación: rutas de éxito,
 * errores RFC 7807 (`application/problem+json`), cabecera `Location` al crear y
 * `204` al borrar. Así los tests no dependen de un broker real en CI.
 *
 * Nombres reservados que fuerzan errores: un topic/grupo `inexistente` responde
 * `404`; crear el topic `existente` responde `409`.
 */
export interface BrokerDouble {
  readonly baseUrl: string;
  /** Nº total de conexiones upstream que ha recibido el SSE (probar reconexión). */
  streamConnectionCount(): number;
  /** Nº de conexiones SSE **abiertas ahora** (probar el cierre limpio). */
  openStreamCount(): number;
  close(): Promise<void>;
}

/** Opciones del doble. `requireAuth` simula un broker arrancado con `--jwt-secret`. */
export interface BrokerDoubleOptions {
  /** Si `true`, las rutas `/api/v1/*` (salvo observabilidad abierta) exigen Bearer. */
  readonly requireAuth?: boolean;
  /** Si `true`, el SSE emite un frame y cierra (fuerza reconexión del BFF). */
  readonly streamCloseAfterFirstFrame?: boolean;
}

/** Contexto de enrutado (config + callbacks de estado mutable del doble). */
interface RouteContext {
  readonly requireAuth: boolean;
  readonly streamCloseAfterFirstFrame: boolean;
  onStreamConnection(): void;
  onStreamClose(): void;
}

/** Token que el doble considera **inválido** (para probar el rechazo del login). */
export const INVALID_TOKEN = 'token-malo';

/**
 * `MetricsSnapshot` **real** del contrato (una entrada por serie con `name`/`type`/
 * `labels`), con los nombres REALES del broker (`nexus_broker_*`). El BFF es
 * passthrough: no interpreta la forma, pero el doble no debe mentir (F5.8).
 */
function metricsSnapshot(): unknown {
  return {
    metrics: [
      {
        name: 'nexus_broker_requests_total',
        type: 'counter',
        labels: { api: 'produce', protocol: 'native' },
        value: 1000,
      },
      {
        name: 'nexus_broker_requests_total',
        type: 'counter',
        labels: { api: 'fetch', protocol: 'native' },
        value: 500,
      },
      {
        name: 'nexus_broker_connections_active',
        type: 'gauge',
        labels: { plane: 'admin' },
        value: 2,
      },
    ],
  };
}

function extractBearer(req: IncomingMessage): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length);
}

interface ProblemBody {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown, location?: string): void {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (location !== undefined) {
    headers['location'] = location;
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function sendProblem(res: ServerResponse, status: number, title: string, detail?: string): void {
  const body: ProblemBody = { type: 'about:blank', title, status, detail };
  res.writeHead(status, { 'content-type': 'application/problem+json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Sirve el SSE `metrics`. Emite un primer frame de inmediato; luego, o cierra
 * (para forzar la reconexión del BFF) o emite frames periódicos hasta que la
 * conexión se cierre.
 */
function serveStream(res: ServerResponse, ctx: RouteContext): void {
  ctx.onStreamConnection();
  res.on('close', () => ctx.onStreamClose());
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const frame = (): void => {
    res.write(`event: metrics\ndata: ${JSON.stringify(metricsSnapshot())}\n\n`);
  };
  frame();

  if (ctx.streamCloseAfterFirstFrame) {
    res.end();
    return;
  }

  const interval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(interval);
      return;
    }
    frame();
  }, 25);
  res.on('close', () => clearInterval(interval));
}

async function route(req: IncomingMessage, res: ServerResponse, ctx: RouteContext): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;

  // --- Observabilidad abierta (sin auth, contract security: []) ---------------
  if (method === 'GET' && path === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }
  if (method === 'GET' && path === '/readyz') {
    sendJson(res, 200, { status: 'ready', checks: [{ name: 'disk', healthy: true }] });
    return;
  }
  if (method === 'GET' && path === '/api/v1/metrics/snapshot') {
    sendJson(res, 200, metricsSnapshot());
    return;
  }
  if (method === 'GET' && path === '/api/v1/stream') {
    serveStream(res, ctx);
    return;
  }

  // --- Puerta de auth (modo secreto): el resto de /api/v1/* exige Bearer ------
  if (ctx.requireAuth) {
    const token = extractBearer(req);
    if (token === undefined || token === INVALID_TOKEN) {
      sendProblem(res, 401, 'No autorizado', 'Falta un token válido (Bearer).');
      return;
    }
  }

  // --- Topics -----------------------------------------------------------------
  if (path === '/api/v1/topics') {
    if (method === 'GET') {
      const page = Number(url.searchParams.get('page') ?? '1');
      const size = Number(url.searchParams.get('size') ?? '20');
      // TopicPage del contrato: { page, size, items } (sin `total`).
      sendJson(res, 200, { page, size, items: [] });
      return;
    }
    if (method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { name?: string };
      const name = body.name ?? '';
      if (name === 'existente') {
        sendProblem(res, 409, 'El topic ya existe', `Ya existe un topic llamado "${name}".`);
        return;
      }
      sendJson(
        res,
        201,
        { name, partitionCount: 1, replicationFactor: 1, createdAtMs: 1_700_000_000_000 },
        `/api/v1/topics/${encodeURIComponent(name)}`,
      );
      return;
    }
  }
  if (path.startsWith('/api/v1/topics/')) {
    const name = decodeURIComponent(path.slice('/api/v1/topics/'.length));
    if (name === 'inexistente') {
      sendProblem(res, 404, 'Topic no encontrado', `No existe el topic "${name}".`);
      return;
    }
    if (method === 'GET') {
      sendJson(res, 200, {
        name,
        partitionCount: 1,
        replicationFactor: 1,
        createdAtMs: 1_700_000_000_000,
        config: { retentionMs: -1, retentionBytes: -1, segmentBytes: 0 },
        partitions: [],
      });
      return;
    }
    if (method === 'PATCH') {
      sendJson(res, 200, {
        name,
        partitionCount: 1,
        replicationFactor: 1,
        createdAtMs: 1_700_000_000_000,
      });
      return;
    }
    if (method === 'DELETE') {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // --- Groups -----------------------------------------------------------------
  if (path === '/api/v1/groups' && method === 'GET') {
    const page = Number(url.searchParams.get('page') ?? '1');
    const size = Number(url.searchParams.get('size') ?? '20');
    // GroupPage del contrato: { page, size, items } (sin `total`).
    sendJson(res, 200, { page, size, items: [] });
    return;
  }
  if (path.startsWith('/api/v1/groups/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/api/v1/groups/'.length));
    if (id === 'inexistente') {
      sendProblem(res, 404, 'Grupo no encontrado', `No existe el grupo "${id}".`);
      return;
    }
    // GroupDescription del contrato: { groupId, state, generation, leaderId, members, offsets }.
    sendJson(res, 200, {
      groupId: id,
      state: 'Stable',
      generation: 1,
      leaderId: '',
      members: [],
      offsets: [],
    });
    return;
  }

  // --- Cluster ----------------------------------------------------------------
  if (path === '/api/v1/cluster' && method === 'GET') {
    // ClusterInfo del contrato: { nodeId, nodes:[{nodeId,isSelf}], partitions }.
    // Single-node RF=1: sin particiones replicadas (no hay consenso Raft que emitir).
    sendJson(res, 200, { nodeId: 1, nodes: [{ nodeId: 1, isSelf: true }], partitions: [] });
    return;
  }

  sendProblem(res, 404, 'Ruta no encontrada', `El doble no enruta ${method} ${path}.`);
}

/** Arranca el doble en un puerto libre de `127.0.0.1` y devuelve su URL base. */
export async function startBrokerDouble(options: BrokerDoubleOptions = {}): Promise<BrokerDouble> {
  let streamConnections = 0;
  let openStreams = 0;
  const ctx: RouteContext = {
    requireAuth: options.requireAuth ?? false,
    streamCloseAfterFirstFrame: options.streamCloseAfterFirstFrame ?? false,
    onStreamConnection: () => {
      streamConnections += 1;
      openStreams += 1;
    },
    onStreamClose: () => {
      openStreams = Math.max(0, openStreams - 1);
    },
  };

  const server: Server = createServer((req, res) => {
    void route(req, res, ctx).catch(() => {
      if (!res.headersSent) {
        sendProblem(res, 500, 'Error del doble');
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    streamConnectionCount: () => streamConnections,
    openStreamCount: () => openStreams,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
