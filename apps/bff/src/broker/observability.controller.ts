import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { sendProxyResult } from '../common/send-proxy-result';
import { BrokerService } from './broker.service';

/**
 * Proxy de la observabilidad *abierta* del broker: sondas de vida/preparación
 * (`healthz`/`readyz`, que pueden responder 200 o 503) y el snapshot de
 * métricas. Son endpoints sin auth en el contrato; se reemiten *verbatim*.
 *
 * Nota: `/healthz` es la salud **del broker**; no confundir con `/health`, que
 * reporta la salud **del propio BFF** (`HealthController`).
 */
@Controller()
export class ObservabilityController {
  constructor(private readonly broker: BrokerService) {}

  @Get('healthz')
  async healthz(@Res() res: Response): Promise<void> {
    const result = await this.broker.forward({ method: 'GET', path: '/healthz' });
    sendProxyResult(res, result);
  }

  @Get('readyz')
  async readyz(@Res() res: Response): Promise<void> {
    const result = await this.broker.forward({ method: 'GET', path: '/readyz' });
    sendProxyResult(res, result);
  }

  @Get('api/v1/metrics/snapshot')
  async metricsSnapshot(@Res() res: Response): Promise<void> {
    const result = await this.broker.forward({ method: 'GET', path: '/api/v1/metrics/snapshot' });
    sendProxyResult(res, result);
  }
}
