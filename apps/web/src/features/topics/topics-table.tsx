import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import type { TopicSummary } from './use-topics';

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Tabla de topics. Cada fila es seleccionable (el nombre es un botón, accesible
 * por teclado) y abre el detalle; la fila activa se resalta. El nombre queda como
 * texto de la celda para lectores y para las aserciones por rol.
 */
export function TopicsTable({
  topics,
  selectedName,
  onSelect,
}: {
  readonly topics: readonly TopicSummary[];
  readonly selectedName: string | null;
  readonly onSelect: (name: string) => void;
}): ReactNode {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">
              Nombre
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Particiones
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Réplicas
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Creado
            </th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => {
            const selected = topic.name === selectedName;
            return (
              <tr
                key={topic.name}
                aria-selected={selected}
                className={cn(
                  'border-b border-border transition-colors last:border-0',
                  selected ? 'bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(topic.name)}
                    className="rounded font-medium text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {topic.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {topic.partitionCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {topic.replicationFactor}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {DATE_FORMAT.format(topic.createdAtMs)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
