import createClient, { type Client, type ClientOptions } from 'openapi-fetch';

import type { paths } from './generated/schema.js';

/**
 * Cliente `openapi-fetch` tipado contra el contrato REST de NexusMQ.
 *
 * @remarks
 * Los métodos (`GET`, `POST`, `DELETE`, `PATCH`...) quedan tipados por las rutas
 * del OpenAPI: parámetros de ruta/consulta, cuerpos y respuestas se infieren de
 * {@link paths}. Este es el único punto por el que la consola habla el contrato.
 *
 * @public
 */
export type NexusMqClient = Client<paths>;

/**
 * Opciones para {@link createNexusMqClient}. Extiende las de `openapi-fetch`
 * (cabeceras, `fetch` inyectable, etc.) y fija `baseUrl` como obligatoria.
 *
 * @public
 */
export interface CreateNexusMqClientOptions extends ClientOptions {
  /** URL base del plano de operación (en la consola, siempre el BFF, mismo origen). */
  readonly baseUrl: string;
}

/**
 * Crea un {@link NexusMqClient} tipado.
 *
 * @remarks
 * En la SPA, `baseUrl` apunta al **BFF** (mismo origen); el BFF es quien añade
 * el JWT del broker. El contrato nunca se consume directamente contra el broker
 * desde el navegador.
 *
 * @param options - Configuración del cliente; `baseUrl` es obligatoria.
 * @returns Un cliente tipado contra las rutas del OpenAPI de NexusMQ.
 * @public
 */
export const createNexusMqClient = (options: CreateNexusMqClientOptions): NexusMqClient =>
  createClient<paths>(options);
