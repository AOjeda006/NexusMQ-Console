import type { Response } from 'express';

/**
 * Backpressure acotado para la terminación de SSE. Reemitir cada chunk del
 * upstream con `response.write()` **sin mirar su valor de retorno** deja que Node
 * acumule sin límite en el buffer del socket cuando el cliente es lento: la
 * memoria por conexión crece sin cota. Aquí el bucle **pausa la lectura del
 * upstream hasta `drain`**, propagando el backpressure hasta el broker.
 *
 * Ver `fundamentos/redes/convenciones.md` (streaming, no cargar todo en memoria)
 * y `herramientas/tiempo-real.md` (servidor como fuente de verdad, resiliencia).
 */

/**
 * Escribe un chunk respetando el backpressure: si `write()` devuelve `false` (el
 * buffer del socket está lleno), **espera al evento `drain`** antes de resolver,
 * de modo que el llamador que lee del upstream se pausa. Resuelve de inmediato si
 * la escritura cupo, o si la conexión ya terminó / se abortó (para no colgar el
 * bucle).
 */
export function writeWithBackpressure(
  response: Response,
  chunk: Buffer,
  signal: AbortSignal,
): Promise<void> {
  if (response.writableEnded || signal.aborted) {
    return Promise.resolve();
  }
  if (response.write(chunk)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const settle = (): void => {
      response.off('drain', settle);
      response.off('close', settle);
      response.off('error', settle);
      signal.removeEventListener('abort', settle);
      resolve();
    };
    response.once('drain', settle);
    response.once('close', settle);
    response.once('error', settle);
    signal.addEventListener('abort', settle, { once: true });
  });
}

/**
 * Bombea los chunks del `reader` (cuerpo SSE del broker) hacia la respuesta del
 * navegador **con backpressure**: entre chunk y chunk espera a que el socket
 * drene, así la lectura del upstream no adelanta al ritmo del cliente y la
 * memoria por conexión queda acotada. Sale cuando el upstream termina (`done`) o
 * el cliente se va (`signal` abortada). `onChunk` se invoca por cada chunk (p. ej.
 * para rearmar el timeout de inactividad).
 */
export async function pumpWithBackpressure(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  response: Response,
  signal: AbortSignal,
  onChunk: () => void,
): Promise<void> {
  for (;;) {
    if (signal.aborted) {
      return;
    }
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    onChunk();
    if (value !== undefined && !response.writableEnded) {
      await writeWithBackpressure(response, Buffer.from(value), signal);
    }
  }
}
