import { EventEmitter } from 'node:events';

import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { pumpWithBackpressure, writeWithBackpressure } from './backpressure';

/** Deja correr la cola de (micro)tareas para que el bucle avance de forma determinista. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Respuesta falsa: `EventEmitter` + `write()` con retorno controlable. */
function makeResponse(writeReturns: boolean): Response & { write: ReturnType<typeof vi.fn> } {
  const ee = new EventEmitter() as unknown as Response & { write: ReturnType<typeof vi.fn> } & {
    writableEnded: boolean;
  };
  ee.writableEnded = false;
  ee.write = vi.fn().mockReturnValue(writeReturns);
  return ee;
}

describe('writeWithBackpressure', () => {
  it('resuelve de inmediato si la escritura cupo (write devuelve true)', async () => {
    const res = makeResponse(true);
    const ac = new AbortController();
    await expect(writeWithBackpressure(res, Buffer.from('x'), ac.signal)).resolves.toBeUndefined();
    expect(res.write).toHaveBeenCalledOnce();
  });

  it('se pausa hasta `drain` si el buffer está lleno (write devuelve false)', async () => {
    const res = makeResponse(false);
    const ac = new AbortController();
    let resolved = false;
    const pending = writeWithBackpressure(res, Buffer.from('x'), ac.signal).then(() => {
      resolved = true;
    });

    await flush();
    expect(resolved).toBe(false); // sigue esperando: backpressure aplicado

    res.emit('drain');
    await pending;
    expect(resolved).toBe(true);
  });

  it('no se cuelga si el cliente se va mientras espera `drain` (abort)', async () => {
    const res = makeResponse(false);
    const ac = new AbortController();
    const pending = writeWithBackpressure(res, Buffer.from('x'), ac.signal);
    ac.abort();
    await expect(pending).resolves.toBeUndefined();
  });

  it('no escribe si la respuesta ya terminó', async () => {
    const res = makeResponse(true);
    (res as unknown as { writableEnded: boolean }).writableEnded = true;
    const ac = new AbortController();
    await writeWithBackpressure(res, Buffer.from('x'), ac.signal);
    expect(res.write).not.toHaveBeenCalled();
  });
});

describe('pumpWithBackpressure (cliente lento: la memoria no crece sin límite)', () => {
  it('no lee del upstream más rápido de lo que drena el cliente', async () => {
    // Upstream que emitiría chunks sin fin; contamos cuántos se llegan a leer.
    let reads = 0;
    const reader = {
      read: vi.fn().mockImplementation(() => {
        reads += 1;
        return Promise.resolve({ done: false, value: new Uint8Array([reads]) });
      }),
      releaseLock: vi.fn(),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;

    const res = makeResponse(false); // el cliente está siempre atascado
    const ac = new AbortController();
    const onChunk = vi.fn();

    const done = pumpWithBackpressure(reader, res, ac.signal, onChunk);

    await flush();
    // Con el cliente atascado, solo se leyó/escribió 1 chunk (el bucle está en `drain`).
    expect(reads).toBe(1);

    res.emit('drain'); // deja pasar exactamente uno más
    await flush();
    expect(reads).toBe(2);

    ac.abort(); // el cliente se va: el bucle termina limpio sin leer sin fin
    res.emit('drain');
    await done;
    expect(reads).toBe(2);
  });

  it('termina cuando el upstream cierra (done)', async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1]) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;

    const res = makeResponse(true); // cliente rápido: no hay pausa
    const ac = new AbortController();

    await pumpWithBackpressure(reader, res, ac.signal, vi.fn());
    expect(res.write).toHaveBeenCalledOnce();
  });
});
