import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { GroupStateBadge } from './group-state-badge';
import type { GroupSummary } from './use-groups';

/**
 * Tabla de grupos de consumo. Cada fila es seleccionable (el id es un botón,
 * accesible por teclado) y abre el detalle; la fila activa se resalta.
 */
export function GroupsTable({
  groups,
  selectedId,
  onSelect,
}: {
  readonly groups: readonly GroupSummary[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}): ReactNode {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">
              Grupo
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Estado
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Generación
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Miembros
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const selected = group.groupId === selectedId;
            return (
              <tr
                key={group.groupId}
                aria-selected={selected}
                className={cn(
                  'border-b border-border transition-colors last:border-0',
                  selected ? 'bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(group.groupId)}
                    className="rounded font-medium text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {group.groupId}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <GroupStateBadge state={group.state} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {group.generation}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {group.memberCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
