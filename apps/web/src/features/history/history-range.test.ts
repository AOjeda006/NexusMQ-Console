import { describe, expect, it } from 'vitest';

import {
  alignSeries,
  firstSeriesPoints,
  hasData,
  latencyQuantileQuery,
  resolveWindow,
  throughputQuery,
  type PromSeries,
  RANGE_PRESETS,
} from './history-range';

describe('resolveWindow', () => {
  it('resuelve [ahora − duración, ahora] en segundos Unix', () => {
    const preset = RANGE_PRESETS[1]; // 1 h
    const nowMs = 1_700_000_000_500;
    const window = resolveWindow(preset, nowMs);
    expect(window.endS).toBe(1_700_000_000);
    expect(window.startS).toBe(1_700_000_000 - 3600);
    expect(window.step).toBe(preset.step);
    expect(window.window).toBe(preset.window);
  });
});

describe('constructores de PromQL (nombres reales del broker, filtrados por api)', () => {
  it('throughput agrega y suaviza requests_total filtrado por api', () => {
    expect(throughputQuery('produce', '2m')).toBe(
      'sum(rate(nexus_broker_requests_total{api="produce"}[2m]))',
    );
    expect(throughputQuery('fetch', '2m')).toBe(
      'sum(rate(nexus_broker_requests_total{api="fetch"}[2m]))',
    );
  });

  it('cuantil de latencia usa histogram_quantile del bucket de produce agregado por le', () => {
    expect(latencyQuantileQuery(0.99, '5m')).toBe(
      'histogram_quantile(0.99, sum(rate(nexus_broker_request_duration_seconds_bucket{api="produce"}[5m])) by (le))',
    );
  });
});

describe('firstSeriesPoints', () => {
  it('normaliza la primera serie de la matriz (valor string → número)', () => {
    const result: readonly PromSeries[] = [
      { metric: {}, values: [[100, '10.5'], [115, '25']] },
      { metric: {}, values: [[100, '1']] },
    ];
    expect(firstSeriesPoints(result)).toEqual([
      { ts: 100, v: 10.5 },
      { ts: 115, v: 25 },
    ]);
  });

  it('convierte NaN de Prometheus en hueco (null)', () => {
    const result: readonly PromSeries[] = [{ metric: {}, values: [[100, 'NaN']] }];
    expect(firstSeriesPoints(result)).toEqual([{ ts: 100, v: null }]);
  });

  it('degrada a [] con una matriz vacía', () => {
    expect(firstSeriesPoints([])).toEqual([]);
  });
});

describe('alignSeries', () => {
  it('alinea series que comparten rejilla y aplica la escala', () => {
    const data = alignSeries([
      { points: [{ ts: 10, v: 1 }, { ts: 20, v: 2 }], scale: 1 },
      { points: [{ ts: 10, v: 0.05 }, { ts: 20, v: 0.06 }], scale: 1000 },
    ]);
    expect(data).toEqual([
      [10, 20],
      [1, 2],
      [50, 60],
    ]);
    expect(hasData(data)).toBe(true);
  });

  it('rellena con null los instantes que a una serie le faltan (unión del eje X)', () => {
    const data = alignSeries([
      { points: [{ ts: 10, v: 1 }, { ts: 30, v: 3 }], scale: 1 },
      { points: [{ ts: 20, v: 9 }], scale: 1 },
    ]);
    expect(data).toEqual([
      [10, 20, 30],
      [1, null, 3],
      [null, 9, null],
    ]);
  });

  it('hasData es false cuando no hay instantes', () => {
    expect(hasData(alignSeries([{ points: [], scale: 1 }]))).toBe(false);
  });
});
