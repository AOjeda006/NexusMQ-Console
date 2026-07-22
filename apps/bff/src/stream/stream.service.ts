import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Agent, type Dispatcher, fetch } from 'undici';

import { BrokerService } from '../broker/broker.service';
import { ConfigService } from '../config/config.service';
import { pumpWithBackpressure } from './backpressure';
import { backoffDelayMs, sleep } from './reconnect';

/** Latido para mantener viva la conexión del navegador (y atravesar proxies). */
const HEARTBEAT_MS = 15_000;
/** Tope para **establecer** la conexión upstream (no aplica al stream ya abierto). */
const CONNECT_TIMEOUT_MS = 10_000;
/** Si el upstream no emite nada en este tiempo, se reconecta (medio-abierto). */
const IDLE_TIMEOUT_MS = 30_000;
const BACKOFF = { initialMs: 500, maxMs: 15_000 } as const;

/**
 * **Terminación de SSE.** El BFF abre `GET /api/v1/stream` del broker y reemite
 * los frames al navegador (mismo origen). La conexión del navegador es estable:
 * si el broker cae, el BFF **reconecta** con backoff+jitter **sin cerrar** el
 * `EventSource` del cliente; cuando el cliente se va, el BFF **aborta** el
 * upstream y cierra limpio. El mecanismo es SSE (una vía servidor→cliente), no
 * WebSocket.
 */
@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  /** Mismo criterio TLS que el proxy REST (relajable con la config del broker). */
  private readonly dispatcher: Dispatcher | undefined;

  constructor(
    private readonly broker: BrokerService,
    config: ConfigService,
  ) {
    this.dispatcher = config.brokerTlsRejectUnauthorized
      ? undefined
      : new Agent({ connect: { rejectUnauthorized: false } });
  }

  /** URL del stream SSE del broker que se termina y reemite. */
  get upstreamStreamUrl(): string {
    return `${this.broker.targetBaseUrl.replace(/\/+$/, '')}/api/v1/stream`;
  }

  /**
   * Termina el SSE hacia el navegador: fija las cabeceras `text/event-stream`,
   * arranca el latido y reemite los frames del broker reconectando mientras el
   * cliente siga conectado. Resuelve cuando el cliente se desconecta.
   */
  async pipe(request: Request, response: Response): Promise<void> {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    // Desactiva el buffering de proxies inversos (nginx) para que los frames
    // lleguen en tiempo real.
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const clientGone = new AbortController();
    request.on('close', () => clientGone.abort());

    const heartbeat = setInterval(() => {
      if (!response.writableEnded) {
        response.write(': keep-alive\n\n');
      }
    }, HEARTBEAT_MS);

    try {
      await this.forwardLoop(response, clientGone.signal);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      clearInterval(heartbeat);
      if (!response.writableEnded) {
        response.end();
      }
    }
  }

  /** Bucle de reconexión: reintenta mientras el cliente siga conectado. */
  private async forwardLoop(response: Response, clientSignal: AbortSignal): Promise<void> {
    let attempt = 0;
    while (!clientSignal.aborted) {
      try {
        await this.streamOnce(response, clientSignal);
        attempt = 0; // cierre limpio del broker: reconecta desde el suelo.
      } catch (error) {
        if (clientSignal.aborted) {
          break;
        }
        this.logger.warn(
          `Stream del broker interrumpido; reconectando: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      if (
        clientSignal.aborted ||
        !(await sleep(backoffDelayMs(attempt++, BACKOFF), clientSignal))
      ) {
        break;
      }
    }
  }

  /**
   * Una conexión al upstream: la establece con timeout, y reemite cada chunk al
   * navegador hasta que el broker cierra (`done`), el cliente se va, o salta el
   * timeout de inactividad. Lanza si el upstream falla (lo gestiona el bucle).
   */
  private async streamOnce(response: Response, clientSignal: AbortSignal): Promise<void> {
    if (clientSignal.aborted) {
      return;
    }

    const attempt = new AbortController();
    const onClientGone = (): void => attempt.abort();
    clientSignal.addEventListener('abort', onClientGone, { once: true });

    // El timeout de conexión solo cubre el establecimiento; se limpia al recibir
    // las cabeceras. El de inactividad se rearma con cada chunk.
    let watchdog = setTimeout(() => attempt.abort(), CONNECT_TIMEOUT_MS);

    try {
      const upstream = await fetch(this.upstreamStreamUrl, {
        method: 'GET',
        headers: { accept: 'text/event-stream' },
        signal: attempt.signal,
        dispatcher: this.dispatcher,
      });

      if (upstream.status !== 200 || upstream.body === null) {
        throw new Error(`el broker respondió ${upstream.status} al stream`);
      }

      const reader = upstream.body.getReader();
      const rearmIdle = (): void => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => attempt.abort(), IDLE_TIMEOUT_MS);
      };
      rearmIdle();

      // Reemite cada chunk **con backpressure acotado**: si el cliente es lento,
      // el bucle se pausa hasta `drain` en lugar de bufferizar sin límite.
      await pumpWithBackpressure(reader, response, attempt.signal, rearmIdle);
    } finally {
      clearTimeout(watchdog);
      clientSignal.removeEventListener('abort', onClientGone);
    }
  }
}
