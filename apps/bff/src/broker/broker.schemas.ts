import { z } from 'zod';

/**
 * Esquemas de **validación en el borde** del proxy REST. Reflejan las
 * restricciones del contrato de NexusMQ (paginación acotada, `segmentBytes`
 * create-only) para rechazar peticiones inválidas en el BFF —con 400 RFC 7807—
 * antes de molestar al broker. El broker sigue siendo la autoridad: aquí solo se
 * filtra lo estructuralmente imposible.
 */

/** Paginación común de `topics` y `groups`: `page ≥ 1`, `size ∈ [1, 100]`. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

/** Alta de topic: `name` obligatorio no vacío; el resto, opcional y acotado. */
export const createTopicSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del topic no puede estar vacío.'),
  partitionCount: z.number().int().min(1).optional(),
  replicationFactor: z.number().int().min(1).optional(),
  segmentBytes: z.number().int().min(0).optional(),
  retentionMs: z.number().int().optional(),
  retentionBytes: z.number().int().optional(),
});

/**
 * PATCH de topic: solo retención mutable en caliente. `.strict()` rechaza
 * `segmentBytes` (create-only) y cualquier campo desconocido con 400, como
 * indica el contrato.
 */
export const alterTopicSchema = z
  .object({
    retentionMs: z.number().int().optional(),
    retentionBytes: z.number().int().optional(),
  })
  .strict('Solo se admiten `retentionMs` y `retentionBytes`; `segmentBytes` es create-only.');

/** Nombre de topic en la ruta: no vacío. */
export const topicNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre del topic no puede estar vacío.');

/** Identificador de grupo en la ruta: no vacío. */
export const groupIdSchema = z.string().trim().min(1, 'El id del grupo no puede estar vacío.');

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type CreateTopicBody = z.infer<typeof createTopicSchema>;
export type AlterTopicBody = z.infer<typeof alterTopicSchema>;
