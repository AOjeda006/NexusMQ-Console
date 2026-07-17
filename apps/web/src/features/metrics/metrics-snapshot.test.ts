import { describe, expect, it } from 'vitest';

import {
  deltaHistogram,
  findCounter,
  findGauge,
  findHistogram,
  histogramQuantile,
  type MetricsSnapshot,
  toMillis,
} from './metrics-snapshot';

/** Cubos (le en segundos) con una distribución cuyos cuantiles conocemos. */
const LES = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] as const;
const CUM = [80, 380, 640, 850, 950, 990, 997, 999, 1000, 1000] as const;

function snapshotWith(scale = 1): MetricsSnapshot {
  return {
    metrics: [
      { name: 'nexusmq_messages_in_total', type: 'counter', labels: {}, value: 1000 * scale },
      { name: 'nexusmq_messages_out_total', type: 'counter', labels: {}, value: 800 * scale },
      { name: 'nexusmq_connections_active', type: 'gauge', labels: {}, value: 120 },
      {
        name: 'nexusmq_produce_latency_seconds',
        type: 'histogram',
        labels: {},
        count: 1000 * scale,
        sum: 6 * scale,
        buckets: LES.map((le, i) => ({ le, cumulativeCount: CUM[i] * scale })),
      },
    ],
  };
}

describe('findCounter / findGauge', () => {
  it('lee counters y gauges por nombre', () => {
    const snap = snapshotWith();
    expect(findCounter(snap, 'nexusmq_messages_in_total')).toBe(1000);
    expect(findGauge(snap, 'nexusmq_connections_active')).toBe(120);
  });

  it('devuelve null si la serie no existe', () => {
    expect(findCounter(snapshotWith(), 'ausente')).toBeNull();
  });

  it('suma varias series con el mismo nombre (p. ej. por partición)', () => {
    const snap: MetricsSnapshot = {
      metrics: [
        { name: 'x_total', type: 'counter', labels: { p: '0' }, value: 10 },
        { name: 'x_total', type: 'counter', labels: { p: '1' }, value: 32 },
      ],
    };
    expect(findCounter(snap, 'x_total')).toBe(42);
  });

  it('no confunde un gauge con un counter del mismo nombre', () => {
    const snap: MetricsSnapshot = {
      metrics: [{ name: 'n', type: 'gauge', labels: {}, value: 5 }],
    };
    expect(findCounter(snap, 'n')).toBeNull();
    expect(findGauge(snap, 'n')).toBe(5);
  });
});

describe('histogramQuantile', () => {
  const hist = findHistogram(snapshotWith(), 'nexusmq_produce_latency_seconds');

  it('interpola p50, p99 y p999 dentro del cubo correcto', () => {
    expect(hist).not.toBeNull();
    if (hist === null) return;
    // p50 (rank 500) cae en (0.0025, 0.005] ≈ 3.65 ms.
    expect(toMillis(histogramQuantile(hist.buckets, hist.count, 0.5))).toBeCloseTo(3.654, 2);
    // p99 (rank 990) llega justo al borde de 0.05 → 50 ms.
    expect(toMillis(histogramQuantile(hist.buckets, hist.count, 0.99))).toBeCloseTo(50, 5);
    // p999 (rank 999) llega al borde de 0.25 → 250 ms.
    expect(toMillis(histogramQuantile(hist.buckets, hist.count, 0.999))).toBeCloseTo(250, 5);
  });

  it('devuelve null sin observaciones', () => {
    expect(histogramQuantile([], 0, 0.5)).toBeNull();
    expect(histogramQuantile([{ le: 1, cumulativeCount: 0 }], 0, 0.5)).toBeNull();
  });

  it('un cuantil en el cubo +Inf devuelve el último le finito', () => {
    // count 100 pero los cubos finitos solo cubren 90 ⇒ p99 (rank 99) está en +Inf.
    const buckets = [
      { le: 0.1, cumulativeCount: 50 },
      { le: 1, cumulativeCount: 90 },
    ];
    expect(histogramQuantile(buckets, 100, 0.99)).toBe(1);
  });
});

describe('deltaHistogram', () => {
  it('recupera la distribución del último intervalo entre dos lecturas acumulativas', () => {
    const prev = findHistogram(snapshotWith(1), 'nexusmq_produce_latency_seconds');
    const curr = findHistogram(snapshotWith(2), 'nexusmq_produce_latency_seconds');
    expect(prev).not.toBeNull();
    expect(curr).not.toBeNull();
    if (prev === null || curr === null) return;

    const delta = deltaHistogram(prev, curr);
    expect(delta).not.toBeNull();
    if (delta === null) return;

    // El intervalo aporta exactamente otra tanda de 1000 observaciones…
    expect(delta.count).toBe(1000);
    // …con los mismos cuantiles que la distribución por intervalo.
    expect(toMillis(histogramQuantile(delta.buckets, delta.count, 0.99))).toBeCloseTo(50, 5);
  });

  it('null si no hubo observaciones nuevas (cubos idénticos)', () => {
    const same = findHistogram(snapshotWith(1), 'nexusmq_produce_latency_seconds');
    if (same === null) throw new Error('histograma esperado');
    expect(deltaHistogram(same, same)).toBeNull();
  });

  it('null si los cubos no están alineados', () => {
    const a: ReturnType<typeof findHistogram> = {
      count: 10,
      sum: 1,
      buckets: [{ le: 1, cumulativeCount: 10 }],
    };
    const b: ReturnType<typeof findHistogram> = {
      count: 20,
      sum: 2,
      buckets: [
        { le: 2, cumulativeCount: 12 },
        { le: 5, cumulativeCount: 20 },
      ],
    };
    expect(deltaHistogram(a, b)).toBeNull();
  });
});
