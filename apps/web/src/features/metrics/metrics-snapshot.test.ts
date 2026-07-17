import { describe, expect, it } from 'vitest';

import {
  deltaHistogram,
  findCounter,
  findGauge,
  findHistogram,
  histogramQuantile,
  METRIC,
  type MetricsSnapshot,
  toMillis,
} from './metrics-snapshot';

/** Cubos (le en segundos) con una distribución cuyos cuantiles conocemos. */
const LES = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] as const;
const CUM = [80, 380, 640, 850, 950, 990, 997, 999, 1000, 1000] as const;
/** Una distribución distinta para `fetch` (latencias más altas), para detectar mezclas. */
const FETCH_CUM = [0, 0, 0, 10, 40, 120, 300, 480, 495, 500] as const;

function bucketsFrom(cum: readonly number[], scale = 1): { le: number; cumulativeCount: number }[] {
  return LES.map((le, i) => ({ le, cumulativeCount: cum[i] * scale }));
}

/**
 * Snapshot con las métricas y labels **REALES** del broker: familias del plano de
 * datos `nexus_broker_*` desglosadas por `{api: produce|fetch, protocol}`, y
 * `connections_active` por `{plane}`. Los valores de `produce` y `fetch` difieren
 * a propósito para detectar mezclas por label.
 */
function snapshotWith(scale = 1): MetricsSnapshot {
  return {
    metrics: [
      // requests_total: produce (1000+200) y fetch (500+100) por protocolo.
      { name: METRIC.requests, type: 'counter', labels: { api: 'produce', protocol: 'native' }, value: 1000 * scale },
      { name: METRIC.requests, type: 'counter', labels: { api: 'produce', protocol: 'kafka' }, value: 200 * scale },
      { name: METRIC.requests, type: 'counter', labels: { api: 'fetch', protocol: 'native' }, value: 500 * scale },
      { name: METRIC.requests, type: 'counter', labels: { api: 'fetch', protocol: 'kafka' }, value: 100 * scale },
      // errores: solo native, produce y fetch.
      { name: METRIC.requestErrors, type: 'counter', labels: { api: 'produce', protocol: 'native' }, value: 3 * scale },
      { name: METRIC.requestErrors, type: 'counter', labels: { api: 'fetch', protocol: 'native' }, value: 1 * scale },
      // conexiones activas por plano.
      { name: METRIC.connections, type: 'gauge', labels: { plane: 'native' }, value: 80 },
      { name: METRIC.connections, type: 'gauge', labels: { plane: 'kafka' }, value: 30 },
      { name: METRIC.connections, type: 'gauge', labels: { plane: 'admin' }, value: 10 },
      // latencia: produce native (dist. conocida), produce kafka (parcial), fetch native (otra dist.).
      {
        name: METRIC.requestDuration,
        type: 'histogram',
        labels: { api: 'produce', protocol: 'native' },
        count: 1000 * scale,
        sum: 6 * scale,
        buckets: bucketsFrom(CUM, scale),
      },
      {
        name: METRIC.requestDuration,
        type: 'histogram',
        labels: { api: 'produce', protocol: 'kafka' },
        count: 300 * scale,
        sum: 2 * scale,
        buckets: bucketsFrom([20, 100, 180, 240, 280, 295, 299, 300, 300, 300], scale),
      },
      {
        name: METRIC.requestDuration,
        type: 'histogram',
        labels: { api: 'fetch', protocol: 'native' },
        count: 500 * scale,
        sum: 40 * scale,
        buckets: bucketsFrom(FETCH_CUM, scale),
      },
    ],
  };
}

describe('findCounter / findGauge con filtrado por label', () => {
  it('filtra por api sin mezclar produce y fetch (el bug que los dobles ocultaban)', () => {
    const snap = snapshotWith();
    // produce = native (1000) + kafka (200); fetch = native (500) + kafka (100).
    expect(findCounter(snap, METRIC.requests, { api: 'produce' })).toBe(1200);
    expect(findCounter(snap, METRIC.requests, { api: 'fetch' })).toBe(600);
    // Sin selector, suma TODAS las series (equivalente a `sum(...)`).
    expect(findCounter(snap, METRIC.requests)).toBe(1800);
  });

  it('un selector con varias claves exige que todas coincidan', () => {
    const snap = snapshotWith();
    expect(findCounter(snap, METRIC.requests, { api: 'produce', protocol: 'native' })).toBe(1000);
    expect(findCounter(snap, METRIC.requests, { api: 'produce', protocol: 'kafka' })).toBe(200);
  });

  it('suma el gauge de conexiones por plano', () => {
    const snap = snapshotWith();
    expect(findGauge(snap, METRIC.connections)).toBe(120);
    expect(findGauge(snap, METRIC.connections, { plane: 'admin' })).toBe(10);
  });

  it('devuelve null si la serie (o el selector) no casa ninguna muestra', () => {
    expect(findCounter(snapshotWith(), 'ausente')).toBeNull();
    expect(findCounter(snapshotWith(), METRIC.requests, { api: 'inexistente' })).toBeNull();
  });

  it('no confunde un gauge con un counter del mismo nombre', () => {
    const snap: MetricsSnapshot = {
      metrics: [{ name: 'n', type: 'gauge', labels: {}, value: 5 }],
    };
    expect(findCounter(snap, 'n')).toBeNull();
    expect(findGauge(snap, 'n')).toBe(5);
  });
});

describe('findHistogram con filtrado y agregación por le', () => {
  it('agrega todas las series que casan el selector (produce = native + kafka)', () => {
    const hist = findHistogram(snapshotWith(), METRIC.requestDuration, { api: 'produce' });
    expect(hist).not.toBeNull();
    if (hist === null) return;
    // count agregado = 1000 (native) + 300 (kafka).
    expect(hist.count).toBe(1300);
    // El cubo +Inf (último le finito acumulado) = 1000 + 300.
    const last = hist.buckets[hist.buckets.length - 1];
    expect(last.cumulativeCount).toBe(1300);
  });

  it('no incluye series de otra api (produce no arrastra fetch)', () => {
    const produce = findHistogram(snapshotWith(), METRIC.requestDuration, {
      api: 'produce',
      protocol: 'native',
    });
    expect(produce?.count).toBe(1000);
  });
});

describe('histogramQuantile', () => {
  const hist = findHistogram(snapshotWith(), METRIC.requestDuration, {
    api: 'produce',
    protocol: 'native',
  });

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
  const produceNative = { api: 'produce', protocol: 'native' };

  it('recupera la distribución del último intervalo entre dos lecturas acumulativas', () => {
    const prev = findHistogram(snapshotWith(1), METRIC.requestDuration, produceNative);
    const curr = findHistogram(snapshotWith(2), METRIC.requestDuration, produceNative);
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
    const same = findHistogram(snapshotWith(1), METRIC.requestDuration, produceNative);
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
