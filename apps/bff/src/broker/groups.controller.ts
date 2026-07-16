import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { sendProxyResult } from '../common/send-proxy-result';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { groupIdSchema, type PaginationQuery, paginationQuerySchema } from './broker.schemas';
import { BrokerService } from './broker.service';

/**
 * Proxy de `groups` (lista paginada + descripción por `id`). Controlador fino:
 * valida en el borde y reemite la respuesta del broker *verbatim*.
 */
@Controller('api/v1/groups')
export class GroupsController {
  constructor(private readonly broker: BrokerService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'GET',
      path: '/api/v1/groups',
      query: { page: query.page, size: query.size },
    });
    sendProxyResult(res, result);
  }

  @Get(':id')
  async describe(
    @Param('id', new ZodValidationPipe(groupIdSchema)) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'GET',
      path: `/api/v1/groups/${encodeURIComponent(id)}`,
    });
    sendProxyResult(res, result);
  }
}
