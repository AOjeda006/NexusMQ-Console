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
  close(): Promise<void>;
}

/** Opciones del doble. `requireAuth` simula un broker arrancado con `--jwt-secret`. */
export interface BrokerDoubleOptions {
  /** Si `true`, las rutas `/api/v1/*` (salvo observabilidad abierta) exigen Bearer. */
  readonly requireAuth?: boolean;
}

/** Token que el doble considera **inválido** (para probar el rechazo del login). */
export const INVALID_TOKEN = 'token-malo';

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

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  requireAuth: boolean,
): Promise<void> {
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
    sendJson(res, 200, { generatedAtMs: 1_700_000_000_000, topics: 0, messagesIn: 0 });
    return;
  }

  // --- Puerta de auth (modo secreto): el resto de /api/v1/* exige Bearer ------
  if (requireAuth) {
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
      sendJson(res, 200, { items: [], page, size, total: 0 });
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
    sendJson(res, 200, { items: [], page, size, total: 0 });
    return;
  }
  if (path.startsWith('/api/v1/groups/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/api/v1/groups/'.length));
    if (id === 'inexistente') {
      sendProblem(res, 404, 'Grupo no encontrado', `No existe el grupo "${id}".`);
      return;
    }
    sendJson(res, 200, { id, members: [], partitions: [] });
    return;
  }

  // --- Cluster ----------------------------------------------------------------
  if (path === '/api/v1/cluster' && method === 'GET') {
    sendJson(res, 200, { nodeId: 1, nodes: [{ id: 1, address: '127.0.0.1:9644' }], partitions: [] });
    return;
  }

  sendProblem(res, 404, 'Ruta no encontrada', `El doble no enruta ${method} ${path}.`);
}

/** Arranca el doble en un puerto libre de `127.0.0.1` y devuelve su URL base. */
export async function startBrokerDouble(options: BrokerDoubleOptions = {}): Promise<BrokerDouble> {
  const requireAuth = options.requireAuth ?? false;
  const server: Server = createServer((req, res) => {
    void route(req, res, requireAuth).catch(() => {
      if (!res.headersSent) {
        sendProblem(res, 500, 'Error del doble');
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
