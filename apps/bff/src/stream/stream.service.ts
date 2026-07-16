import { Injectable } from '@nestjs/common';

import { BrokerService } from '../broker/broker.service';

/**
 * Terminación de SSE: el BFF se conecta al `GET /api/v1/stream` del broker y
 * **reemite** los eventos al navegador (mismo origen), con reconexión, timeout y
 * cierre limpio.
 *
 * @remarks
 * El mecanismo es **SSE (`EventSource`)**, una vía servidor→cliente; no
 * WebSocket. La implementación llega en **F1.5**; aquí queda el esqueleto con la
 * URL upstream derivada del broker.
 */
@Injectable()
export class StreamService {
  constructor(private readonly broker: BrokerService) {}

  /** URL del stream SSE del broker que se terminará y reemitirá (F1.5). */
  get upstreamStreamUrl(): string {
    return `${this.broker.targetBaseUrl}/api/v1/stream`;
  }
}
