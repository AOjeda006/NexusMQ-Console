import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { sendProxyResult } from '../common/send-proxy-result';
import { BrokerService } from './broker.service';

/** Proxy de `cluster` (estado del clúster y consenso Raft). Solo lectura. */
@Controller('api/v1/cluster')
export class ClusterController {
  constructor(private readonly broker: BrokerService) {}

  @Get()
  async describe(@Res() res: Response): Promise<void> {
    const result = await this.broker.forward({ method: 'GET', path: '/api/v1/cluster' });
    sendProxyResult(res, result);
  }
}
