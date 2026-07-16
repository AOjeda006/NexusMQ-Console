/**
 * Paquete de contrato de NexusMQ (`@nexusmq/contract`).
 *
 * @remarks
 * Reexporta los tipos generados con `openapi-typescript` a partir del OpenAPI
 * vendorizado de NexusMQ y un cliente `openapi-fetch` tipado. **El contrato
 * nunca se escribe a mano**: para actualizarlo, corre `sync:openapi` + `generate`.
 *
 * @packageDocumentation
 */

export { createNexusMqClient } from './client.js';
export type { CreateNexusMqClientOptions, NexusMqClient } from './client.js';
export type { components, operations, paths, webhooks } from './generated/schema.js';
