import { useEffect, useRef, useState } from 'react';

/** Estado del flujo en vivo. */
export type LiveStatus = 'connecting' | 'live' | 'polling' | 'error';

/** Origen del último dato recibido. */
export type LiveSource = 'sse' | 'polling';

export interface LiveStreamState<T> {
  /** Último dato recibido (por SSE o por polling); persiste al cambiar de fuente. */
  readonly data: T | undefined;
  readonly status: LiveStatus;
  readonly source: LiveSource | null;
  /** Marca de tiempo (ms) de la última actualización, para detectar liveness. */
  readonly lastUpdatedAtMs: number | null;
}

export interface UseLiveStreamOptions<T> {
  /** Parseo de un frame/cuerpo crudo a `T` (lanzar si es inválido lo descarta). */
  readonly parse: (raw: string) => T;
  /** Ruta del SSE del BFF (mismo origen). */
  readonly streamPath?: string;
  /** Ruta de snapshot para el fallback por polling. */
  readonly snapshotPath?: string;
  /** Nombre del evento SSE a escuchar. */
  readonly eventName?: string;
  /** Periodo de polling del fallback (ms). */
  readonly pollIntervalMs?: number;
  /** Nº de errores SSE transitorios antes de caer a polling. */
  readonly sseFailureThreshold?: number;
  /** Si es `false`, no abre ninguna conexión. */
  readonly enabled?: boolean;
}

const INITIAL: LiveStreamState<never> = {
  data: undefined,
  status: 'connecting',
  source: null,
  lastUpdatedAtMs: null,
};

/**
 * Suscribe la UI al flujo en vivo del broker vía el **SSE del BFF** y, si el SSE
 * falla (error fatal del `EventSource` o varios reintentos transitorios seguidos),
 * **cae a polling** del snapshot **sin romper la UI** (el último dato persiste y
 * la fuente pasa a `polling`). La recuperación a SSE ocurre al cambiar las
 * entradas (p. ej. reintentar la ruta) o al remontar.
 *
 * @remarks
 * El SSE del BFF es resiliente (latidos + reconexión al broker), así que un corte
 * del broker no tumba este `EventSource`; el fallback aquí cubre que el propio
 * plano SSE del BFF deje de estar disponible.
 */
export function useLiveStream<T>(options: UseLiveStreamOptions<T>): LiveStreamState<T> {
  const {
    streamPath = '/api/v1/stream',
    snapshotPath = '/api/v1/metrics/snapshot',
    eventName = 'metrics',
    pollIntervalMs = 4000,
    sseFailureThreshold = 2,
    enabled = true,
  } = options;

  // El parse puede cambiar de identidad cada render; se lee por ref para no
  // reabrir la conexión por ello.
  const parseRef = useRef(options.parse);
  parseRef.current = options.parse;

  const [state, setState] = useState<LiveStreamState<T>>(INITIAL);

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL);
      return;
    }

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let phase: LiveSource = 'sse';
    let failures = 0;

    const patch = (next: Partial<LiveStreamState<T>>): void => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, ...next }));
      }
    };

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(snapshotPath, { headers: { accept: 'application/json' } });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = parseRef.current(await response.text());
        patch({ data, status: 'polling', source: 'polling', lastUpdatedAtMs: Date.now() });
      } catch {
        // Un fallo puntual del snapshot no rompe la UI: se señaliza y se reintenta.
        patch({ status: 'error' });
      }
    };

    const startPolling = (): void => {
      if (phase === 'polling') {
        return;
      }
      phase = 'polling';
      if (eventSource !== null) {
        eventSource.close();
        eventSource = null;
      }
      patch({ status: 'polling', source: 'polling' });
      void poll();
      pollTimer = setInterval(() => void poll(), pollIntervalMs);
    };

    const connect = (): void => {
      const source = new EventSource(streamPath);
      eventSource = source;

      source.addEventListener(eventName, (event) => {
        failures = 0;
        try {
          const data = parseRef.current((event as MessageEvent<string>).data);
          patch({ data, status: 'live', source: 'sse', lastUpdatedAtMs: Date.now() });
        } catch {
          // Frame mal formado: se descarta sin tumbar la conexión.
        }
      });

      source.onopen = () => {
        failures = 0;
        if (phase === 'sse') {
          patch({ status: 'live', source: 'sse' });
        }
      };

      source.onerror = () => {
        if (phase !== 'sse' || cancelled) {
          return;
        }
        const isClosed = source.readyState === EventSource.CLOSED;
        failures += 1;
        if (isClosed || failures >= sseFailureThreshold) {
          startPolling();
        } else {
          patch({ status: 'connecting' });
        }
      };
    };

    setState(INITIAL);
    connect();

    return () => {
      cancelled = true;
      if (eventSource !== null) {
        eventSource.close();
      }
      if (pollTimer !== null) {
        clearInterval(pollTimer);
      }
    };
  }, [streamPath, snapshotPath, eventName, pollIntervalMs, sseFailureThreshold, enabled]);

  return state;
}
