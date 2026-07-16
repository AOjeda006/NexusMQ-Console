import type { paths } from '@nexusmq/contract';

/**
 * Marcador de posición del BFF (`@nexusmq/bff`).
 *
 * @remarks
 * El servidor real (NestJS, arquitectura limpia por módulos) se monta en la
 * Fase 1. Por ahora importa el contrato para verificar que `@nexusmq/contract`
 * resuelve y tipa desde el BFF (criterio de aceptación de F0.2).
 *
 * @public
 */
export const bffPackageName = '@nexusmq/bff';

/** Rutas del contrato de NexusMQ, disponibles para el proxy del BFF. */
export type BffContractPaths = paths;
