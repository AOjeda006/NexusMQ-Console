import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ProblemDetailsFilter } from './problem-details.filter';

/**
 * Piezas transversales del BFF. Registra el `ProblemDetailsFilter` como filtro
 * **global** vía `APP_FILTER`, de modo que tanto el bootstrap real como los
 * tests e2e obtienen el mismo mapeo de errores a `application/problem+json` sin
 * configuración adicional.
 */
@Module({
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class CommonModule {}
