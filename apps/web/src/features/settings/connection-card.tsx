import { CircleCheck, CircleSlash, Info, Server } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { Card } from '@/components/ui/card';

import { useHistoryStatus } from './use-history-status';

/**
 * Información de **conexión y observabilidad**. El destino del broker vive
 * **confinado en el servidor** (env de despliegue del BFF): no se reconfigura
 * desde el navegador a propósito —el token queda confinado y se evita que el
 * cliente redirija el BFF a hosts arbitrarios (SSRF)—. Aquí se muestran las
 * señales que sí son seguras de exponer.
 */
export function ConnectionCard(): ReactNode {
  const history = useHistoryStatus();
  const prometheusAvailable = history.data?.available ?? null;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">Conexión y observabilidad</h2>
        <p className="text-xs text-muted-foreground">Estado de los planos que sirve el BFF.</p>
      </div>

      <dl className="space-y-3">
        <Row
          Icon={Server}
          label="Destino del broker"
          value="Confinado en el servidor (BFF)"
          hint="Se fija en el despliegue; el navegador nunca habla directo con el broker."
        />
        <Row
          Icon={prometheusAvailable === true ? CircleCheck : CircleSlash}
          iconClass={
            prometheusAvailable === true
              ? 'text-success'
              : prometheusAvailable === false
                ? 'text-faint-foreground'
                : 'text-muted-foreground'
          }
          label="Historia (Prometheus)"
          value={
            prometheusAvailable === null
              ? 'Comprobando…'
              : prometheusAvailable
                ? 'Disponible'
                : 'No configurada'
          }
          hint={
            prometheusAvailable === false
              ? 'Sin PROMETHEUS_URL: las vistas de historia (Fase 4) se degradan con aviso.'
              : undefined
          }
        />
      </dl>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Los <strong className="font-medium text-foreground">perfiles de conexión</strong> (cambiar
        de broker) son materia de despliegue: reconfigurar el destino desde el navegador expondría
        al BFF a redirigir peticiones a hosts arbitrarios, así que se mantiene confinado en el
        servidor por seguridad.
      </p>
    </Card>
  );
}

function Row({
  Icon,
  iconClass = 'text-muted-foreground',
  label,
  value,
  hint,
}: {
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClass?: string;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}): ReactNode {
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium text-foreground">{value}</dd>
        </div>
        {hint !== undefined && <p className="text-xs text-faint-foreground">{hint}</p>}
      </div>
    </div>
  );
}
