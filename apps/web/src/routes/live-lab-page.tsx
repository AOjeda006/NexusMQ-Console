import { Activity, ArrowLeft, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ComponentType } from 'react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/app/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type LiveStatus, useLiveStream } from '@/features/live/use-live-stream';
import {
  API,
  findCounter,
  METRIC,
  type MetricsSnapshot,
} from '@/features/metrics/metrics-snapshot';

const GOOD_STREAM = '/api/v1/stream';
const BROKEN_STREAM = '/api/v1/stream-broken';

interface StatusMeta {
  readonly label: string;
  readonly dot: string;
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly spin?: boolean;
}

const STATUS_META: Record<LiveStatus, StatusMeta> = {
  connecting: { label: 'Conectando…', dot: 'bg-faint-foreground', Icon: LoaderCircle, spin: true },
  live: { label: 'En vivo (SSE)', dot: 'bg-success', Icon: Activity },
  polling: { label: 'Polling (snapshot)', dot: 'bg-warning', Icon: RefreshCw },
  error: { label: 'Error', dot: 'bg-critical', Icon: TriangleAlert },
};

/**
 * Laboratorio de tiempo real (F2.4): ejercita `useLiveStream` contra el SSE del
 * BFF y su **fallback a polling** del snapshot. «Forzar fallo de SSE» apunta el
 * hook a una ruta rota (fallo real del `EventSource`) para provocar la caída a
 * polling sin romper la UI; «Restaurar SSE» vuelve a la ruta buena.
 */
export function LiveLabPage(): ReactNode {
  const [broken, setBroken] = useState(false);
  const parse = useCallback(
    (raw: string): MetricsSnapshot => JSON.parse(raw) as MetricsSnapshot,
    [],
  );

  const live = useLiveStream<MetricsSnapshot>({
    parse,
    streamPath: broken ? BROKEN_STREAM : GOOD_STREAM,
    pollIntervalMs: 1500,
  });

  const produceRequests = live.data
    ? findCounter(live.data, METRIC.requests, { api: API.produce })
    : null;

  const meta = STATUS_META[live.status];
  const updatedLabel = useMemo(
    () =>
      live.lastUpdatedAtMs === null
        ? '—'
        : new Date(live.lastUpdatedAtMs).toLocaleTimeString('es-ES', { hour12: false }),
    [live.lastUpdatedAtMs],
  );

  return (
    <main className="min-h-screen bg-page px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Volver a la consola
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Laboratorio de tiempo real</h1>
            <p className="text-sm text-muted-foreground">
              F2.4: SSE del BFF con fallback a polling del snapshot.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Card
          className="space-y-5 p-6"
          data-testid="live-panel"
          data-status={live.status}
          data-source={live.source ?? ''}
          data-updated={live.lastUpdatedAtMs ?? ''}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <span aria-hidden className={`size-2.5 rounded-full ${meta.dot}`} />
              <meta.Icon
                aria-hidden
                className={`size-4 ${meta.spin === true ? 'animate-spin' : ''}`}
              />
              {meta.label}
            </span>
            <span className="text-xs text-muted-foreground">Fuente: {live.source ?? '—'}</span>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-0.5">
              <dt className="text-xs uppercase tracking-wide text-faint-foreground">
                Última actualización
              </dt>
              <dd className="font-medium tabular-nums text-foreground" data-testid="live-updated">
                {updatedLabel}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs uppercase tracking-wide text-faint-foreground">
                Peticiones (produce) acumuladas
              </dt>
              <dd className="font-medium tabular-nums text-foreground">
                {produceRequests === null ? '—' : produceRequests.toLocaleString('es-ES')}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={broken ? 'ghost' : 'primary'}
              onClick={() => setBroken(true)}
              disabled={broken}
            >
              Forzar fallo de SSE
            </Button>
            <Button
              variant={broken ? 'primary' : 'ghost'}
              onClick={() => setBroken(false)}
              disabled={!broken}
            >
              Restaurar SSE
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
