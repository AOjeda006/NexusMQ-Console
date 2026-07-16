import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { StreamService } from './stream.service';

/**
 * Termina el SSE del broker en el mismo origen que la SPA. Ruta **abierta** (el
 * stream del broker es `security: []` en el contrato, igual que
 * `metrics/snapshot`): el navegador la consume con `EventSource`.
 */
@Controller('api/v1/stream')
export class StreamController {
  constructor(private readonly stream: StreamService) {}

  @Get()
  async subscribe(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.stream.pipe(request, response);
  }
}
