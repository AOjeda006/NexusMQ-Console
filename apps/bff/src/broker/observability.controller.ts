import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { BrokerToken } from '../auth/authenticated-request';
import { Protected } from '../auth/protected.decorator';
import { sendProxyResult } from '../common/send-proxy-result';
import { BrokerService } from './broker.service';

/**
 * Proxy de la observabilidad del broker: sondas de vida/preparación
 * (`healthz`/`readyz`, **abiertas**, para probes) y el **snapshot de métricas**,
 * que pasa a ser `@Protected` (exige sesión) para no filtrar datos operativos sin
 * login; se reemiten *verbatim*.
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

  @Protected()
  @Get('api/v1/metrics/snapshot')
  async metricsSnapshot(
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'GET',
      path: '/api/v1/metrics/snapshot',
      token,
    });
    sendProxyResult(res, result);
  }
}
