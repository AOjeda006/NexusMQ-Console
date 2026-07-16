import { createNexusMqClient, type NexusMqClient } from '@nexusmq/contract';

/**
 * Cliente tipado del contrato de NexusMQ apuntando al **BFF** (mismo origen). La
 * SPA nunca habla con el broker directamente: el BFF proxya, confina el JWT y
 * termina el SSE. Al ser mismo origen, la cookie de sesión httpOnly viaja sola
 * (`credentials` por defecto `same-origin`), sin exponer nada al JavaScript.
 *
 * Este es el único punto por el que la consola consume el contrato REST.
 */
export const apiClient: NexusMqClient = createNexusMqClient({
  baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
});
