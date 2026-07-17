import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

/**
 * Ficha de indicador (patrón *hero number* de la skill dataviz): una etiqueta
 * discreta, un número grande y legible (`tabular-nums` para que no baile en
 * vivo), una unidad opcional y una línea de apoyo. La identidad de color, si la
 * hay, la lleva una **marca** (punto/icono) al lado, nunca el propio número
 * —el texto viste tinta, no el color de serie—.
 */
export function StatTile({
  label,
  value,
  unit,
  sub,
  mark,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly sub?: ReactNode;
  readonly mark?: ReactNode;
  readonly testId?: string;
}): ReactNode {
  return (
    <Card className="flex flex-col gap-1.5 p-4" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
          {label}
        </span>
        {mark}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums leading-none text-foreground">
          {value}
        </span>
        {unit !== undefined && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub !== undefined && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
