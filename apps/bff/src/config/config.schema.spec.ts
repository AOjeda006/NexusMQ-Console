import { describe, expect, it } from 'vitest';

import { ConfigValidationError, validateEnv } from './config.schema';

describe('validateEnv (config fail-fast)', () => {
  const base = {
    BROKER_ADMIN_URL: 'http://localhost:9644',
    SESSION_SECRET: 'a'.repeat(32),
  } satisfies NodeJS.ProcessEnv;

  it('acepta un entorno válido y normaliza los valores', () => {
    const cfg = validateEnv({ ...base, PORT: '4000', PROMETHEUS_URL: 'http://prometheus:9090' });

    expect(cfg.port).toBe(4000);
    expect(cfg.brokerAdminUrl).toBe('http://localhost:9644');
    expect(cfg.prometheusUrl).toBe('http://prometheus:9090');
    expect(cfg.brokerTlsRejectUnauthorized).toBe(true);
  });

  it('aplica defaults: puerto 3000, TLS estricto y sin Prometheus', () => {
    const cfg = validateEnv({ ...base });

    expect(cfg.port).toBe(3000);
    expect(cfg.prometheusUrl).toBeUndefined();
    expect(cfg.brokerTlsRejectUnauthorized).toBe(true);
  });

  it('permite desactivar la validación TLS del broker con "false"', () => {
    const cfg = validateEnv({ ...base, BROKER_TLS_REJECT_UNAUTHORIZED: 'false' });

    expect(cfg.brokerTlsRejectUnauthorized).toBe(false);
  });

  it('aborta con un mensaje claro si falta BROKER_ADMIN_URL', () => {
    const run = (): unknown => validateEnv({ SESSION_SECRET: 'a'.repeat(32) });

    expect(run).toThrow(ConfigValidationError);
    expect(run).toThrow(/BROKER_ADMIN_URL/);
  });

  it('rechaza un SESSION_SECRET demasiado corto', () => {
    expect(() => validateEnv({ ...base, SESSION_SECRET: 'corto' })).toThrow(/SESSION_SECRET/);
  });

  it('rechaza una BROKER_ADMIN_URL que no es URL', () => {
    expect(() => validateEnv({ ...base, BROKER_ADMIN_URL: 'no-es-una-url' })).toThrow(
      /BROKER_ADMIN_URL/,
    );
  });
});
