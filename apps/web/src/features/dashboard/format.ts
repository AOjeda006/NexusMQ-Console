/** Marcador de dato ausente (degradación honesta). */
export const EMPTY = '—';

/** Número compacto (12 500 → «12,5 k»); `null`/no finito → «—». */
export function compact(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${round(value / 1_000_000, digits)} M`;
  }
  if (abs >= 1000) {
    return `${round(value / 1000, digits)} k`;
  }
  return round(value, abs < 10 ? digits : 0);
}

/** Milisegundos con una decimal por debajo de 10 ms; `null` → «—». */
export function millis(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY;
  }
  return `${round(value, value < 10 ? 2 : value < 100 ? 1 : 0)} ms`;
}

/** Entero con separador de miles (es-ES); `null` → «—». */
export function integer(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY;
  }
  return Math.round(value).toLocaleString('es-ES');
}

/** Caudal de bytes/s en unidades decimales (B/s → kB/s → MB/s → GB/s); `null` → «—». */
export function bytesRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY;
  }
  const units = ['B/s', 'kB/s', 'MB/s', 'GB/s', 'TB/s'];
  let scaled = value;
  let unit = 0;
  while (Math.abs(scaled) >= 1000 && unit < units.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  return `${round(scaled, scaled < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

/** Porcentaje (0–1 → «1,2 %») con una decimal por debajo de 10 %; `null` → «—». */
export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY;
  }
  const pct = value * 100;
  return `${round(pct, pct < 10 ? 1 : 0)} %`;
}

function round(value: number, digits: number): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
