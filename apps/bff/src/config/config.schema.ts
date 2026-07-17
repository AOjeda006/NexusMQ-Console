import { z } from 'zod';

/**
 * Esquema del entorno del BFF: **fuente única** de la configuración validada.
 * Es allow-list (solo estas claves) y *fail-fast* — un valor inválido aborta el
 * arranque con un mensaje claro (ver {@link validateEnv}).
 */
const envSchema = z.object({
  /** Entorno de ejecución. Gobierna el `Secure` de la cookie y el servido de la SPA. */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Puerto de escucha del BFF. */
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  /** URL base del plano de operación (admin) del broker. Obligatoria. */
  BROKER_ADMIN_URL: z
    .string({ required_error: 'requerida: URL del plano admin del broker' })
    .url('debe ser una URL válida (p. ej. http://localhost:9644)'),

  /** URL de Prometheus para las vistas de historia. Opcional (degradación limpia). */
  PROMETHEUS_URL: z.string().url('debe ser una URL válida').optional(),

  /** Secreto para firmar la cookie de sesión httpOnly del BFF. */
  SESSION_SECRET: z
    .string({ required_error: 'requerido: secreto para firmar la sesión' })
    .min(32, 'debe tener al menos 32 caracteres'),

  /** TTL de una sesión de operador, en horas; caducada, da 401 y se purga. Por defecto 8 h. */
  SESSION_TTL_HOURS: z.coerce.number().positive().max(720).default(8),

  /** Ruta a un bundle de CAs extra (Node lo lee de forma nativa). Opcional. */
  NODE_EXTRA_CA_CERTS: z.string().min(1).optional(),

  /** ¿Validar el certificado TLS del broker al hacer de proxy? Por defecto sí. */
  BROKER_TLS_REJECT_UNAUTHORIZED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  /** Directorio del build estático de la SPA a servir en `/` (F1.7). Opcional. */
  WEB_DIST_PATH: z.string().min(1).optional(),
});

/** Configuración del BFF ya validada y normalizada. */
export interface BffConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly brokerAdminUrl: string;
  readonly prometheusUrl: string | undefined;
  readonly sessionSecret: string;
  readonly sessionTtlMs: number;
  readonly nodeExtraCaCerts: string | undefined;
  readonly brokerTlsRejectUnauthorized: boolean;
  readonly webDistPath: string | undefined;
}

/** Error de configuración de arranque: mensaje legible con las claves ofensivas. */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Valida el entorno contra {@link envSchema} y devuelve la config tipada. Ante
 * cualquier problema lanza {@link ConfigValidationError} con el detalle por
 * clave, de modo que el arranque falle pronto y con un mensaje accionable.
 */
export function validateEnv(env: NodeJS.ProcessEnv): BffConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Configuración de entorno inválida:\n${detail}\n` +
        'Corrige las variables y reinicia el BFF.',
    );
  }

  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    brokerAdminUrl: e.BROKER_ADMIN_URL,
    prometheusUrl: e.PROMETHEUS_URL,
    sessionSecret: e.SESSION_SECRET,
    sessionTtlMs: e.SESSION_TTL_HOURS * 3_600_000,
    nodeExtraCaCerts: e.NODE_EXTRA_CA_CERTS,
    brokerTlsRejectUnauthorized: e.BROKER_TLS_REJECT_UNAUTHORIZED,
    webDistPath: e.WEB_DIST_PATH,
  };
}
