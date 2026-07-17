/** Convención del contrato: `-1` = sin límite (retención por tiempo o tamaño). */
export const UNLIMITED = -1;

const MS_UNITS: readonly {
  readonly limit: number;
  readonly div: number;
  readonly suffix: string;
}[] = [
  { limit: 1000, div: 1, suffix: 'ms' },
  { limit: 60_000, div: 1000, suffix: 's' },
  { limit: 3_600_000, div: 60_000, suffix: 'min' },
  { limit: 86_400_000, div: 3_600_000, suffix: 'h' },
  { limit: Infinity, div: 86_400_000, suffix: 'd' },
];

/** Retención por tiempo legible: `-1` → «Sin límite»; si no, la unidad natural. */
export function formatRetentionMs(ms: number): string {
  if (ms === UNLIMITED) {
    return 'Sin límite';
  }
  if (ms === 0) {
    return '0 ms';
  }
  const abs = Math.abs(ms);
  const unit = MS_UNITS.find((u) => abs < u.limit) ?? MS_UNITS[MS_UNITS.length - 1];
  return `${trim(ms / unit.div)} ${unit.suffix}`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/** Retención por tamaño legible: `-1` → «Sin límite»; si no, en múltiplos de 1024. */
export function formatBytes(bytes: number): string {
  if (bytes === UNLIMITED) {
    return 'Sin límite';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const exponent = Math.min(Math.floor(Math.log2(Math.abs(bytes)) / 10), BYTE_UNITS.length - 1);
  return `${trim(bytes / 1024 ** exponent)} ${BYTE_UNITS[exponent]}`;
}

/** Número con hasta una decimal, sin ceros de relleno (es-ES). */
function trim(value: number): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}
