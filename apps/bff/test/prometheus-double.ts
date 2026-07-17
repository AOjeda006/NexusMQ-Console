import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Doble mínimo y determinista de **Prometheus** para los e2e de historia (F1.6).
 * Imita `GET /api/v1/query_range`: éxito con forma `matrix`, y un caso de error
 * (`query=boom`) que devuelve 400 `status: "error"` como el Prometheus real.
 */
export interface PrometheusDouble {
  readonly baseUrl: string;
  close(): Promise<void>;
}

/** Consulta que el doble trata como inválida (para probar el 400 propagado). */
export const BAD_QUERY = 'boom';

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function route(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/api/v1/query_range') {
    if (url.searchParams.get('query') === BAD_QUERY) {
      sendJson(res, 400, { status: 'error', errorType: 'bad_data', error: 'parse error en la query' });
      return;
    }
    sendJson(res, 200, {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'nexus_broker_requests_total', api: 'produce' },
            values: [
              [1_700_000_000, '10'],
              [1_700_000_015, '25'],
            ],
          },
        ],
      },
    });
    return;
  }
  sendJson(res, 404, { status: 'error', errorType: 'not_found', error: 'ruta no soportada' });
}

/** Arranca el doble de Prometheus en un puerto libre de `127.0.0.1`. */
export async function startPrometheusDouble(): Promise<PrometheusDouble> {
  const server: Server = createServer(route);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
