import { Injectable } from '@nestjs/common';

/** Informe de salud propio del BFF (no confundir con el `/healthz` del broker). */
export interface HealthReport {
  readonly status: 'ok';
  readonly service: string;
  readonly uptimeSeconds: number;
}

/**
 * Salud del propio proceso del BFF. Es *liveness* local: no consulta al broker
 * (eso se reexpone en F1.3 como parte del proxy de `/healthz` y `/readyz`).
 */
@Injectable()
export class HealthService {
  private readonly startedAtMs = Date.now();

  report(): HealthReport {
    return {
      status: 'ok',
      service: '@nexusmq/bff',
      uptimeSeconds: Math.floor((Date.now() - this.startedAtMs) / 1000),
    };
  }
}
