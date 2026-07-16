import type { paths } from '@nexusmq/contract';

/**
 * Marcador de posición de la SPA (`@nexusmq/web`).
 *
 * @remarks
 * La app real (Vite + React + sistema de diseño dataviz) se monta en la Fase 2.
 * Por ahora importa el contrato para verificar que `@nexusmq/contract` resuelve
 * y tipa desde la SPA (criterio de aceptación de F0.2).
 *
 * @public
 */
export const webPackageName = '@nexusmq/web';

/** Rutas del contrato de NexusMQ, disponibles para la capa de datos de la SPA. */
export type WebContractPaths = paths;
