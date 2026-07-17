import { createServer } from 'node:http';

/**
 * Doble mínimo del broker NexusMQ para los e2e full-stack (F2.2/F2.4/F3.1/F3.2).
 * Imita el plano de operación lo justo para ejercitar el camino real
 * SPA → BFF → broker. Es determinista y sin dependencias.
 *
 * - `/api/v1/topics` (protegido): **CRUD con estado real** — listar (paginado),
 *   crear (409 si existe), describir (config + particiones), alterar retención
 *   (PATCH) y borrar (204). El estado vive en memoria: crear/PATCH/borrar surten
 *   efecto real en las siguientes lecturas.
 * - `/api/v1/cluster` (protegido): `ClusterInfo` con consenso Raft vivo.
 * - `/api/v1/metrics/snapshot` y `/api/v1/stream` (abiertos): `MetricsSnapshot`
 *   del contrato desde un reloj único (snapshot y SSE coherentes).
 */

const PORT = Number(process.env['FAKE_BROKER_PORT'] ?? '4319');
const GOOD_TOKEN = process.env['FAKE_BROKER_TOKEN'] ?? 'good-operator-token';
const TICK_MS = 500;

// --- Topics: estado real en memoria -----------------------------------------

const GiB = 1024 ** 3;

/** @type {Map<string, { partitionCount: number; replicationFactor: number; segmentBytes: number; retentionMs: number; retentionBytes: number; createdAtMs: number }>} */
const topics = new Map([
  [
    'orders.events',
    {
      partitionCount: 6,
      replicationFactor: 3,
      segmentBytes: GiB,
      retentionMs: 604_800_000,
      retentionBytes: -1,
      createdAtMs: 1_720_000_000_000,
    },
  ],
  [
    'payments.settled',
    {
      partitionCount: 3,
      replicationFactor: 3,
      segmentBytes: GiB,
      retentionMs: -1,
      retentionBytes: -1,
      createdAtMs: 1_721_000_000_000,
    },
  ],
  [
    'audit.log',
    {
      partitionCount: 1,
      replicationFactor: 1,
      segmentBytes: 512 * 1024 * 1024,
      retentionMs: -1,
      retentionBytes: -1,
      createdAtMs: 1_722_000_000_000,
    },
  ],
  [
    'telemetry.raw',
    {
      partitionCount: 12,
      replicationFactor: 2,
      segmentBytes: GiB,
      retentionMs: 86_400_000,
      retentionBytes: 10 * GiB,
      createdAtMs: 1_723_000_000_000,
    },
  ],
]);

function toSummary(name, t) {
  return {
    name,
    partitionCount: t.partitionCount,
    replicationFactor: t.replicationFactor,
    createdAtMs: t.createdAtMs,
  };
}

function toDescription(name, t) {
  const partitions = Array.from({ length: t.partitionCount }, (_, id) => ({
    id,
    leader: (id % t.replicationFactor) + 1,
    highWatermark: 1000 + id * 137,
    leaderEpoch: 4,
  }));
  return {
    ...toSummary(name, t),
    config: {
      retentionMs: t.retentionMs,
      retentionBytes: t.retentionBytes,
      segmentBytes: t.segmentBytes,
    },
    partitions,
  };
}

// --- Métricas: estado que evoluciona en un único reloj -----------------------
//
// Nombres/labels REALES del broker (docs/metrics.md de ../NexusMQ): familias del
// plano de datos `nexus_broker_*` desglosadas por {api: produce|fetch, protocol}
// y `nexus_broker_connections_active{plane}`. Contadores split native(0.7)/kafka(0.3)
// para que el filtrado por label del cliente (produce vs fetch, agregación por
// protocolo) se ejercite de verdad.

const LATENCY_LES = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];
/** Distribución por intervalo de `produce` (cuantiles conocidos: p50≈3,6 ms, p99=50 ms). */
const PRODUCE_INTERVAL = [80, 380, 640, 850, 950, 990, 997, 999, 1000, 1000];
/** Distribución por intervalo de `fetch` (latencias más altas). */
const FETCH_INTERVAL = [0, 0, 0, 40, 120, 260, 400, 470, 495, 500];

const metricsState = {
  tick: 0,
  requests: { produce: 0, fetch: 0 },
  messages: { produce: 0, fetch: 0 },
  bytes: { produce: 0, fetch: 0 },
  errors: { produce: 0, fetch: 0 },
  latency: {
    produce: { count: 0, sum: 0, buckets: LATENCY_LES.map(() => 0) },
    fetch: { count: 0, sum: 0, buckets: LATENCY_LES.map(() => 0) },
  },
  connections: { native: 120, kafka: 40, admin: 6 },
};

function advance() {
  const t = metricsState.tick;
  metricsState.requests.produce += Math.round(4000 + 1500 * Math.sin(t / 4));
  metricsState.requests.fetch += Math.round(2600 + 900 * Math.sin(t / 4 + 0.8));
  metricsState.messages.produce += Math.round(84_000 + 30_000 * Math.sin(t / 4));
  metricsState.messages.fetch += Math.round(52_000 + 18_000 * Math.sin(t / 4 + 0.8));
  metricsState.bytes.produce += Math.round(4_200_000 + 1_500_000 * Math.sin(t / 4));
  metricsState.bytes.fetch += Math.round(2_600_000 + 900_000 * Math.sin(t / 4 + 0.8));
  metricsState.errors.produce += t % 5 === 0 ? 2 : 0;
  metricsState.errors.fetch += t % 8 === 0 ? 1 : 0;
  for (const api of ['produce', 'fetch']) {
    const interval = api === 'produce' ? PRODUCE_INTERVAL : FETCH_INTERVAL;
    metricsState.latency[api].count += interval[interval.length - 1];
    metricsState.latency[api].sum += api === 'produce' ? 6 : 10;
    for (let i = 0; i < interval.length; i += 1) {
      metricsState.latency[api].buckets[i] += interval[i];
    }
  }
  metricsState.connections.native = Math.round(120 + 30 * Math.sin(t / 6));
  metricsState.connections.kafka = Math.round(40 + 12 * Math.sin(t / 6 + 1));
  metricsState.connections.admin = Math.round(6 + 2 * Math.sin(t / 6));
  metricsState.tick = t + 1;
}

/** Un counter split por protocolo (native 0.7 / kafka 0.3) para cada api. */
function counterSamples(name, byApi) {
  const out = [];
  for (const api of ['produce', 'fetch']) {
    const total = byApi[api];
    const native = Math.round(total * 0.7);
    out.push({ name, type: 'counter', labels: { api, protocol: 'native' }, value: native });
    out.push({ name, type: 'counter', labels: { api, protocol: 'kafka' }, value: total - native });
  }
  return out;
}

function metricsSnapshot() {
  const histograms = ['produce', 'fetch'].map((api) => ({
    name: 'nexus_broker_request_duration_seconds',
    type: 'histogram',
    labels: { api, protocol: 'native' },
    count: metricsState.latency[api].count,
    sum: metricsState.latency[api].sum,
    buckets: LATENCY_LES.map((le, i) => ({ le, cumulativeCount: metricsState.latency[api].buckets[i] })),
  }));
  const connections = Object.entries(metricsState.connections).map(([plane, value]) => ({
    name: 'nexus_broker_connections_active',
    type: 'gauge',
    labels: { plane },
    value,
  }));
  return {
    metrics: [
      ...counterSamples('nexus_broker_requests_total', metricsState.requests),
      ...counterSamples('nexus_broker_messages_total', metricsState.messages),
      ...counterSamples('nexus_broker_request_bytes_total', metricsState.bytes),
      ...counterSamples('nexus_broker_request_errors_total', metricsState.errors),
      ...histograms,
      ...connections,
    ],
  };
}

const streamSubscribers = new Set();

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

const ticker = setInterval(() => {
  advance();
  const frame = `event: metrics\ndata: ${JSON.stringify(metricsSnapshot())}\n\n`;
  for (const res of streamSubscribers) {
    safeWrite(res, frame);
  }
}, TICK_MS);
ticker.unref();

// --- Cluster / Raft ----------------------------------------------------------

function clusterInfo() {
  const t = metricsState.tick;
  const base = 10_000 + t * 8;
  const follower = (node, lastLogIndex, lag) => ({ node, matchIndex: lastLogIndex - lag, lag });
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

// --- Groups (consumo) --------------------------------------------------------

const GROUPS = [
  {
    groupId: 'analytics-pipeline',
    state: 'Stable',
    generation: 12,
    leaderId: 'member-a',
    members: [
      { memberId: 'member-a', subscriptionBytes: 320 },
      { memberId: 'member-b', subscriptionBytes: 256 },
    ],
    offsets: [
      { topic: 'orders.events', partition: 0, committedOffset: 9800, highWatermark: 10_000 },
      { topic: 'orders.events', partition: 1, committedOffset: 5000, highWatermark: 5000 },
      { topic: 'orders.events', partition: 2, committedOffset: 3200, highWatermark: 3350 },
    ],
  },
  {
    groupId: 'billing-consumers',
    state: 'Stable',
    generation: 5,
    leaderId: 'member-x',
    members: [{ memberId: 'member-x', subscriptionBytes: 288 }],
    offsets: [
      { topic: 'payments.settled', partition: 0, committedOffset: 1200, highWatermark: 1200 },
    ],
  },
  {
    groupId: 'audit-archiver',
    state: 'Empty',
    generation: 0,
    leaderId: '',
    members: [],
    offsets: [],
  },
];

function groupSummary(g) {
  return {
    groupId: g.groupId,
    state: g.state,
    generation: g.generation,
    memberCount: g.members.length,
  };
}

function groupDescription(g) {
  return {
    groupId: g.groupId,
    state: g.state,
    generation: g.generation,
    leaderId: g.leaderId,
    members: g.members,
    offsets: g.offsets.map((o) => ({ ...o, lag: o.highWatermark - o.committedOffset })),
  };
}

// --- HTTP --------------------------------------------------------------------

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
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

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw === '' ? {} : JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });
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

/** Enruta la superficie protegida de `topics` (exige Bearer válido). */
async function handleTopics(req, res, url) {
  if (bearer(req) !== GOOD_TOKEN) {
    sendProblem(res, 401, 'No autorizado', 'Falta un token válido (Bearer).');
    return;
  }
  const method = req.method ?? 'GET';
  const path = url.pathname;
  const isCollection = path === '/api/v1/topics';
  const name = isCollection ? null : decodeURIComponent(path.slice('/api/v1/topics/'.length));

  if (isCollection && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const size = Math.max(1, Number(url.searchParams.get('size') ?? '20'));
    const all = [...topics.entries()].map(([n, t]) => toSummary(n, t));
    const items = all.slice((page - 1) * size, page * size);
    sendJson(res, 200, { page, size, items });
    return;
  }

  if (isCollection && method === 'POST') {
    const body = await readJson(req);
    if (body === null || typeof body.name !== 'string' || body.name.trim() === '') {
      sendProblem(res, 400, 'Petición inválida', 'El nombre del topic es obligatorio.');
      return;
    }
    const topicName = body.name.trim();
    if (topics.has(topicName)) {
      sendProblem(res, 409, 'Topic ya existe', `El topic «${topicName}» ya está declarado.`);
      return;
    }
    const created = {
      partitionCount: Number(body.partitionCount ?? 1) || 1,
      replicationFactor: Number(body.replicationFactor ?? 1) || 1,
      segmentBytes: Number(body.segmentBytes ?? 0) || 0,
      retentionMs: body.retentionMs === undefined ? -1 : Number(body.retentionMs),
      retentionBytes: body.retentionBytes === undefined ? -1 : Number(body.retentionBytes),
      createdAtMs: Date.now(),
    };
    topics.set(topicName, created);
    sendJson(res, 201, toSummary(topicName, created), {
      location: `/api/v1/topics/${encodeURIComponent(topicName)}`,
    });
    return;
  }

  if (name !== null && method === 'GET') {
    const t = topics.get(name);
    if (t === undefined) {
      sendProblem(res, 404, 'Topic no encontrado', `No existe el topic «${name}».`);
      return;
    }
    sendJson(res, 200, toDescription(name, t));
    return;
  }

  if (name !== null && method === 'PATCH') {
    const t = topics.get(name);
    if (t === undefined) {
      sendProblem(res, 404, 'Topic no encontrado', `No existe el topic «${name}».`);
      return;
    }
    const body = await readJson(req);
    if (body === null) {
      sendProblem(res, 400, 'Petición inválida', 'Cuerpo JSON inválido.');
      return;
    }
    if (body.retentionMs !== undefined) {
      t.retentionMs = Number(body.retentionMs);
    }
    if (body.retentionBytes !== undefined) {
      t.retentionBytes = Number(body.retentionBytes);
    }
    sendJson(res, 200, toSummary(name, t));
    return;
  }

  if (name !== null && method === 'DELETE') {
    if (!topics.has(name)) {
      sendProblem(res, 404, 'Topic no encontrado', `No existe el topic «${name}».`);
      return;
    }
    topics.delete(name);
    res.writeHead(204);
    res.end();
    return;
  }

  sendProblem(res, 404, 'Ruta no encontrada', `El doble no enruta ${method} ${path}.`);
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

  // Superficie protegida (broker en «modo secreto»).
  if (path === '/api/v1/topics' || path.startsWith('/api/v1/topics/')) {
    void handleTopics(req, res, url).catch(() => {
      if (!res.headersSent) {
        sendProblem(res, 500, 'Error del doble', 'Fallo inesperado en el doble del broker.');
      }
    });
    return;
  }
  if (path === '/api/v1/groups' || path.startsWith('/api/v1/groups/')) {
    if (bearer(req) !== GOOD_TOKEN) {
      sendProblem(res, 401, 'No autorizado', 'Falta un token válido (Bearer).');
      return;
    }
    if (path === '/api/v1/groups' && method === 'GET') {
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
      const size = Math.max(1, Number(url.searchParams.get('size') ?? '20'));
      const all = GROUPS.map(groupSummary);
      sendJson(res, 200, { page, size, items: all.slice((page - 1) * size, page * size) });
      return;
    }
    const id = decodeURIComponent(path.slice('/api/v1/groups/'.length));
    const group = GROUPS.find((g) => g.groupId === id);
    if (method === 'GET' && group !== undefined) {
      sendJson(res, 200, groupDescription(group));
      return;
    }
    if (group === undefined) {
      sendProblem(res, 404, 'Grupo no encontrado', `No existe el grupo «${id}».`);
      return;
    }
    sendProblem(res, 404, 'Ruta no encontrada', `El doble no enruta ${method} ${path}.`);
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
