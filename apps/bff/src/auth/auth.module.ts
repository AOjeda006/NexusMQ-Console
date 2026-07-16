import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';

/**
 * Módulo de auth (JWT confinado). Registra el `SessionAuthGuard` como guard
 * **global** vía `APP_GUARD`, de modo que protege las rutas marcadas con
 * `@Protected()` sin que el módulo del broker tenga que importar a este (evita
 * el ciclo: aquí se consume `BrokerService`, que `BrokerModule` expone global).
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: SessionAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
