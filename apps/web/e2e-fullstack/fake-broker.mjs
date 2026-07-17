import { createServer } from 'node:http';

/**
 * Doble mínimo del broker NexusMQ para los e2e full-stack (F2.2/F2.4/F3.1).
 * Imita el plano de operación lo justo para ejercitar el camino real
 * SPA → BFF → broker. Es determinista y sin dependencias.
 *
 * - `/api/v1/topics` exige Bearer (simula un broker con `--jwt-secret`).
 * - `/api/v1/cluster` (protegido) devuelve un `ClusterInfo` con consenso Raft.
 * - `/api/v1/metrics/snapshot` y `/api/v1/stream` (abiertos) emiten el
 *   **`MetricsSnapshot` del contrato** (lista de series estilo Prometheus:
 *   counters de throughput, histograma de latencia, gauge de conexiones) desde
 *   un **estado compartido** que avanza en un único reloj, así el snapshot
 *   (polling) y el SSE son coherentes y se ven evolucionar.
 */

const PORT = Number(process.env['FAKE_BROKER_PORT'] ?? '4319');
const GOOD_TOKEN = process.env['FAKE_BROKER_TOKEN'] ?? 'good-operator-token';
const TICK_MS = 500;

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

// --- Métricas: estado que evoluciona en un único reloj -----------------------

/** Cubos del histograma de latencia (le en segundos) y su distribución por intervalo. */
const LATENCY_LES = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];
const PER_INTERVAL_CUM = [80, 380, 640, 850, 950, 990, 997, 999, 1000, 1000];
const PER_INTERVAL_TOTAL = 1000;

const metricsState = {
  tick: 0,
  messagesIn: 0,
  messagesOut: 0,
  latencyCount: 0,
  latencySum: 0,
  latencyBuckets: LATENCY_LES.map(() => 0),
  connections: 120,
};

/** Avanza el estado un intervalo: throughput ondulado + otra tanda de latencias. */
function advance() {
  const t = metricsState.tick;
  metricsState.messagesIn += Math.round(4000 + 1500 * Math.sin(t / 4));
  metricsState.messagesOut += Math.round(3200 + 1200 * Math.sin(t / 4 + 0.8));
  metricsState.latencyCount += PER_INTERVAL_TOTAL;
  metricsState.latencySum += 6; // ≈ 1000 obs × media 6 ms
  for (let i = 0; i < metricsState.latencyBuckets.length; i += 1) {
    metricsState.latencyBuckets[i] += PER_INTERVAL_CUM[i];
  }
  metricsState.connections = Math.round(120 + 30 * Math.sin(t / 6));
  metricsState.tick = t + 1;
}

/** Construye el `MetricsSnapshot` (forma del contrato) desde el estado actual. */
function metricsSnapshot() {
  return {
    metrics: [
      {
        name: 'nexusmq_messages_in_total',
        type: 'counter',
        labels: {},
        value: metricsState.messagesIn,
      },
      {
        name: 'nexusmq_messages_out_total',
        type: 'counter',
        labels: {},
        value: metricsState.messagesOut,
      },
      {
        name: 'nexusmq_connections_active',
        type: 'gauge',
        labels: {},
        value: metricsState.connections,
      },
      {
        name: 'nexusmq_produce_latency_seconds',
        type: 'histogram',
        labels: {},
        count: metricsState.latencyCount,
        sum: metricsState.latencySum,
        buckets: LATENCY_LES.map((le, i) => ({
          le,
          cumulativeCount: metricsState.latencyBuckets[i],
        })),
      },
    ],
  };
}

/** Suscriptores SSE activos (respuestas HTTP abiertas). */
const streamSubscribers = new Set();

/** Escritura tolerante: un socket ya cerrado no debe tumbar el reloj (ni el proceso). */
function safeWrite(res, frame) {
  if (res.writableEnded || res.destroyed) {
    streamSubscribers.delete(res);
    return;
  }
  try {
    res.write(frame);
  } catch {
    streamSubscribers.delete(res);
  }
}

/** Reloj único: avanza el estado y difunde un frame `metrics` a los suscriptores. */
const ticker = setInterval(() => {
  advance();
  const frame = `event: metrics\ndata: ${JSON.stringify(metricsSnapshot())}\n\n`;
  for (const res of streamSubscribers) {
    safeWrite(res, frame);
  }
}, TICK_MS);
ticker.unref();

// --- Cluster / Raft ----------------------------------------------------------

/** `ClusterInfo` (forma del contrato) que evoluciona con el tick (commit/lag vivos). */
function clusterInfo() {
  const t = metricsState.tick;
  const base = 10_000 + t * 8;
  /** @param {number} node @param {number} lag */
  const follower = (node, lastLogIndex, lag) => ({
    node,
    matchIndex: lastLogIndex - lag,
    lag,
  });
  /** @param {string} topic @param {number} partition @param {number} leader @param {string} role @param {number} term @param {number} commit @param {number} logAhead */
  const part = (topic, partition, leader, role, term, commit, logAhead) => {
    const lastLogIndex = commit + logAhead;
    const isLeader = role === 'leader';
    return {
      topic,
      partition,
      leader,
      role,
      term,
      commitIndex: commit,
      lastLogIndex,
      leaderEpoch: term,
      followers: isLeader
        ? [
            follower(2, lastLogIndex, Math.round(2 + 2 * Math.sin(t / 3))),
            follower(3, lastLogIndex, Math.round(3 + 2 * Math.sin(t / 3 + 1))),
          ]
        : [],
    };
  };

  return {
    nodeId: 1,
    nodes: [
      { nodeId: 1, isSelf: true },
      { nodeId: 2, isSelf: false },
      { nodeId: 3, isSelf: false },
    ],
    partitions: [
      part('orders.events', 0, 1, 'leader', 4, base, 2),
      part('orders.events', 1, 1, 'leader', 4, base - 3, 1),
      part('orders.events', 2, 2, 'follower', 4, base - 5, 0),
      part('payments.settled', 0, 1, 'leader', 5, base + 12, 3),
    ],
  };
}

// --- HTTP --------------------------------------------------------------------

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

function serveStream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  res.write(`event: metrics\ndata: ${JSON.stringify(metricsSnapshot())}\n\n`);
  streamSubscribers.add(res);
  const drop = () => streamSubscribers.delete(res);
  req.on('close', drop);
  res.on('close', drop);
  res.on('error', drop);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // Observabilidad abierta (contract security: []): SSE y snapshot sin Bearer.
  if (method === 'GET' && path === '/api/v1/stream') {
    serveStream(req, res);
    return;
  }
  if (method === 'GET' && path === '/api/v1/metrics/snapshot') {
    sendJson(res, 200, metricsSnapshot());
    return;
  }

  // Superficie protegida (broker en «modo secreto»): exige Bearer válido.
  if (method === 'GET' && path === '/api/v1/topics') {
    if (bearer(req) !== GOOD_TOKEN) {
      sendProblem(res, 401, 'No autorizado', 'Falta un token válido (Bearer).');
      return;
    }
    const size = Number(url.searchParams.get('size') ?? '20');
    sendJson(res, 200, { page: 1, size, items: TOPICS.slice(0, Math.max(0, size)) });
    return;
  }
  if (method === 'GET' && path === '/api/v1/cluster') {
    if (bearer(req) !== GOOD_TOKEN) {
      sendProblem(res, 401, 'No autorizado', 'Falta un token válido (Bearer).');
      return;
    }
    sendJson(res, 200, clusterInfo());
    return;
  }

  sendProblem(res, 404, 'Ruta no encontrada', `El doble no enruta ${method} ${path}.`);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`fake-broker escuchando en http://127.0.0.1:${PORT}\n`);
});
