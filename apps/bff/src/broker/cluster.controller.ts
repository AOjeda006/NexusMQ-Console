import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { BrokerToken } from '../auth/authenticated-request';
import { Protected } from '../auth/protected.decorator';
import { sendProxyResult } from '../common/send-proxy-result';
import { BrokerService } from './broker.service';

/** Proxy de `cluster` (estado del clúster y consenso Raft). Solo lectura. */
@Protected()
@Controller('api/v1/cluster')
export class ClusterController {
  constructor(private readonly broker: BrokerService) {}

  @Get()
  async describe(
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({ method: 'GET', path: '/api/v1/cluster', token });
    sendProxyResult(res, result);
  }
}
