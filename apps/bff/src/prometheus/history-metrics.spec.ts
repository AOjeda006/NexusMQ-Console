import { describe, expect, it } from 'vitest';

import { buildHistoryQuery, HISTORY_METRIC_IDS, isHistoryMetricId } from './history-metrics';

describe('history-metrics (allow-list de PromQL en servidor)', () => {
  it('construye el throughput por api desde requests_total', () => {
    expect(buildHistoryQuery('throughput-produce', '2m')).toBe(
      'sum(rate(nexus_broker_requests_total{api="produce"}[2m]))',
    );
    expect(buildHistoryQuery('throughput-fetch', '2m')).toBe(
      'sum(rate(nexus_broker_requests_total{api="fetch"}[2m]))',
    );
  });

  it('construye los cuantiles de latencia de produce con histogram_quantile', () => {
    expect(buildHistoryQuery('latency-p99', '5m')).toBe(
      'histogram_quantile(0.99, sum(rate(nexus_broker_request_duration_seconds_bucket{api="produce"}[5m])) by (le))',
    );
  });

  it('construye tasa de error, bytes y mensajes', () => {
    expect(buildHistoryQuery('errors', '1m')).toBe(
      'sum(rate(nexus_broker_request_errors_total[1m]))',
    );
    expect(buildHistoryQuery('bytes-produce', '1m')).toBe(
      'sum(rate(nexus_broker_request_bytes_total{api="produce"}[1m]))',
    );
    expect(buildHistoryQuery('messages-fetch', '1m')).toBe(
      'sum(rate(nexus_broker_messages_total{api="fetch"}[1m]))',
    );
  });

  it('reconoce los ids permitidos y rechaza cualquier otra cosa (allow-list cerrada)', () => {
    for (const id of HISTORY_METRIC_IDS) {
      expect(isHistoryMetricId(id)).toBe(true);
    }
    expect(isHistoryMetricId('rm -rf')).toBe(false);
    expect(isHistoryMetricId('nexus_broker_requests_total')).toBe(false);
    expect(isHistoryMetricId('')).toBe(false);
  });
});
