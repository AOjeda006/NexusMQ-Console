import type { ReactNode } from 'react';

import type { TopicSummary } from './use-topics';

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

/** Tabla de topics (solo lectura en F2.2; el CRUD llega en F3.2). */
export function TopicsTable({ topics }: { readonly topics: readonly TopicSummary[] }): ReactNode {
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
          {topics.map((topic) => (
            <tr
              key={topic.name}
              className="border-b border-border transition-colors last:border-0 hover:bg-muted"
            >
              <td className="px-4 py-3 font-medium text-foreground">{topic.name}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
