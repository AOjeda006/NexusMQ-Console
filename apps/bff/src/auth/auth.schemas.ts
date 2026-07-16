import { z } from 'zod';

/** Cuerpo del login: el operador pega un JWT de broker ya emitido (no vacío). */
export const loginSchema = z
  .object({
    token: z.string().trim().min(1, 'El token no puede estar vacío.'),
  })
  .strict();

export type LoginBody = z.infer<typeof loginSchema>;
