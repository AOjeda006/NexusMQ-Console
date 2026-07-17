import { createServer } from 'node:http';

/**
 * Doble mínimo y determinista de **Prometheus** para los e2e full-stack de la
 * historia (F4.1). Imita `GET /api/v1/query_range`: devuelve una `matrix` cuya
 * forma depende de la PromQL recibida (throughput vs. cuantiles de latencia),
 * de modo que cada gráfica muestra datos distintos y no vacíos sobre el rango
 * pedido. Sin estado ni dependencias.
 */

const PORT = Number(process.env['FAKE_PROMETHEUS_PORT'] ?? '4320');

/** Convierte una duración Prometheus (`15s`/`1m`/`1h`) a segundos. */
function durationToSeconds(raw) {
  const match = /^(\d+)(s|m|h)$/.exec(String(raw).trim());
  if (match === null) {
    return 60;
  }
  const n = Number(match[1]);
  return match[2] === 's' ? n : match[2] === 'm' ? n * 60 : n * 3600;
}

/** Valor determinista para una serie, según la query y el índice de muestra. */
function sampleFor(query, i) {
  if (query.includes('messages_in')) {
    return 3500 + 800 * Math.sin(i / 6);
  }
  if (query.includes('messages_out')) {
    return 2800 + 600 * Math.sin(i / 6 + 0.6);
  }
  if (query.includes('0.999')) {
    return 0.24 + 0.03 * Math.sin(i / 5);
  }
  if (query.includes('0.99')) {
    return 0.05 + 0.01 * Math.sin(i / 5);
  }
  if (query.includes('0.5')) {
    return 0.0035 + 0.0008 * Math.sin(i / 5);
  }
  return 1;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;

  if (req.method === 'GET' && (path === '/-/healthy' || path === '/-/ready')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('OK');
    return;
  }

  if (req.method === 'GET' && path === '/api/v1/query_range') {
    const query = url.searchParams.get('query') ?? '';
    const start = Math.floor(Number(url.searchParams.get('start') ?? '0'));
    const end = Math.floor(Number(url.searchParams.get('end') ?? '0'));
    const step = Math.max(1, durationToSeconds(url.searchParams.get('step') ?? '60'));

    const values = [];
    let i = 0;
    for (let ts = start; ts <= end; ts += step, i += 1) {
      values.push([ts, sampleFor(query, i).toFixed(6)]);
    }

    sendJson(res, 200, {
      status: 'success',
      data: { resultType: 'matrix', result: [{ metric: {}, values }] },
    });
    return;
  }

  sendJson(res, 404, { status: 'error', errorType: 'not_found', error: 'ruta no soportada' });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`fake-prometheus escuchando en http://127.0.0.1:${PORT}\n`);
});
