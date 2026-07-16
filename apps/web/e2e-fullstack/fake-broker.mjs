import { createServer } from 'node:http';

/**
 * Doble mínimo del broker NexusMQ para el e2e full-stack de la capa de datos
 * (F2.2). Imita el plano de operación lo justo para ejercitar el camino real
 * SPA → BFF → broker: exige Bearer en `/api/v1/topics` (simula un broker
 * arrancado con `--jwt-secret`) y devuelve una página de topics con datos
 * reconocibles. No pretende ser fiel al broker completo; es determinista y sin
 * dependencias.
 */

const PORT = Number(process.env['FAKE_BROKER_PORT'] ?? '4319');
const GOOD_TOKEN = process.env['FAKE_BROKER_TOKEN'] ?? 'good-operator-token';

/** @type {{ name: string; partitionCount: number; replicationFactor: number; createdAtMs: number }[]} */
const TOPICS = [
  {
    name: 'orders.events',
    partitionCount: 6,
    replicationFactor: 3,
    createdAtMs: 1_720_000_000_000,
  },
  {
    name: 'payments.settled',
    partitionCount: 3,
    replicationFactor: 3,
    createdAtMs: 1_721_000_000_000,
  },
  { name: 'audit.log', partitionCount: 1, replicationFactor: 1, createdAtMs: 1_722_000_000_000 },
  {
    name: 'telemetry.raw',
    partitionCount: 12,
    replicationFactor: 2,
    createdAtMs: 1_723_000_000_000,
  },
];

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendProblem(res, status, title, detail) {
  res.writeHead(status, { 'content-type': 'application/problem+json' });
  res.end(JSON.stringify({ type: 'about:blank', title, status, detail }));
}

function bearer(req) {
  const header = req.headers['authorization'];
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : undefined;
}

/** Snapshot: contador creciente, para que el polling del fallback se vea avanzar. */
let snapshotCounter = 0;

/** SSE `metrics`: emite un frame cada 400 ms hasta que el cliente cierra. */
function serveStream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  let seq = 0;
  const timer = setInterval(() => {
    seq += 1;
    res.write(`event: metrics\ndata: ${JSON.stringify({ seq, generatedAtMs: Date.now() })}\n\n`);
  }, 400);
  req.on('close', () => clearInterval(timer));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // Rutas abiertas (contract security: []): SSE y snapshot no exigen Bearer.
  if (method === 'GET' && path === '/api/v1/stream') {
    serveStream(req, res);
    return;
  }
  if (method === 'GET' && path === '/api/v1/metrics/snapshot') {
    snapshotCounter += 1;
    sendJson(res, 200, {
      generatedAtMs: Date.now(),
      messagesIn: snapshotCounter * 100,
      topics: TOPICS.length,
    });
    return;
  }

  if (method === 'GET' && path === '/api/v1/topics') {
    // Sin token válido ⇒ 401 (así el BFF detecta «modo secreto» y valida el login).
    if (bearer(req) !== GOOD_TOKEN) {
      sendProblem(res, 401, 'No autorizado', 'Falta un token válido (Bearer).');
      return;
    }
    const size = Number(url.searchParams.get('size') ?? '20');
    sendJson(res, 200, { page: 1, size, items: TOPICS.slice(0, Math.max(0, size)) });
    return;
  }

  sendProblem(res, 404, 'Ruta no encontrada', `El doble no enruta ${method} ${path}.`);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`fake-broker escuchando en http://127.0.0.1:${PORT}\n`);
});
