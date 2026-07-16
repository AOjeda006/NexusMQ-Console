import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { sendProxyResult } from '../common/send-proxy-result';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BrokerToken } from '../auth/authenticated-request';
import { Protected } from '../auth/protected.decorator';
import {
  type AlterTopicBody,
  alterTopicSchema,
  type CreateTopicBody,
  createTopicSchema,
  type PaginationQuery,
  paginationQuerySchema,
  topicNameSchema,
} from './broker.schemas';
import { BrokerService } from './broker.service';

/**
 * Proxy de `topics` (CRUD + `PATCH`). Controlador fino: valida en el borde con
 * `ZodValidationPipe`, reenvía con `BrokerService` (inyectando el token
 * confinado de la sesión) y reemite la respuesta del broker *verbatim* con
 * `sendProxyResult`. No interpreta el cuerpo del broker.
 */
@Protected()
@Controller('api/v1/topics')
export class TopicsController {
  constructor(private readonly broker: BrokerService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'GET',
      path: '/api/v1/topics',
      query: { page: query.page, size: query.size },
      token,
    });
    sendProxyResult(res, result);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTopicSchema)) body: CreateTopicBody,
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'POST',
      path: '/api/v1/topics',
      body,
      token,
    });
    sendProxyResult(res, result);
  }

  @Get(':name')
  async describe(
    @Param('name', new ZodValidationPipe(topicNameSchema)) name: string,
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'GET',
      path: `/api/v1/topics/${encodeURIComponent(name)}`,
      token,
    });
    sendProxyResult(res, result);
  }

  @Patch(':name')
  async alter(
    @Param('name', new ZodValidationPipe(topicNameSchema)) name: string,
    @Body(new ZodValidationPipe(alterTopicSchema)) body: AlterTopicBody,
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'PATCH',
      path: `/api/v1/topics/${encodeURIComponent(name)}`,
      body,
      token,
    });
    sendProxyResult(res, result);
  }

  @Delete(':name')
  async remove(
    @Param('name', new ZodValidationPipe(topicNameSchema)) name: string,
    @BrokerToken() token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.broker.forward({
      method: 'DELETE',
      path: `/api/v1/topics/${encodeURIComponent(name)}`,
      token,
    });
    sendProxyResult(res, result);
  }
}
