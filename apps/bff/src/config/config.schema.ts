import { z } from 'zod';

/**
 * Esquema del entorno del BFF: **fuente única** de la configuración validada.
 * Es allow-list (solo estas claves) y *fail-fast* — un valor inválido aborta el
 * arranque con un mensaje claro (ver {@link validateEnv}).
 */
const envSchema = z.object({
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

  /** Ruta a un bundle de CAs extra (Node lo lee de forma nativa). Opcional. */
  NODE_EXTRA_CA_CERTS: z.string().min(1).optional(),

  /** ¿Validar el certificado TLS del broker al hacer de proxy? Por defecto sí. */
  BROKER_TLS_REJECT_UNAUTHORIZED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

/** Configuración del BFF ya validada y normalizada. */
export interface BffConfig {
  readonly port: number;
  readonly brokerAdminUrl: string;
  readonly prometheusUrl: string | undefined;
  readonly sessionSecret: string;
  readonly nodeExtraCaCerts: string | undefined;
  readonly brokerTlsRejectUnauthorized: boolean;
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
    port: e.PORT,
    brokerAdminUrl: e.BROKER_ADMIN_URL,
    prometheusUrl: e.PROMETHEUS_URL,
    sessionSecret: e.SESSION_SECRET,
    nodeExtraCaCerts: e.NODE_EXTRA_CA_CERTS,
    brokerTlsRejectUnauthorized: e.BROKER_TLS_REJECT_UNAUTHORIZED,
  };
}
