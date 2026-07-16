import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { ThemeToggle } from '@/app/theme/theme-toggle';

import { ConnectionStatus } from './connection-status';
import { NAV_ITEMS, SETTINGS_ITEM } from './nav';

/** Título de la sección activa, derivado de la ruta (un único `h1` por vista). */
function useSectionTitle(): string {
  const { pathname } = useLocation();
  const match = [...NAV_ITEMS, SETTINGS_ITEM].find((item) =>
    item.end
      ? pathname === item.path
      : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  return match?.label ?? 'NexusMQ Console';
}

/**
 * Barra superior: título de la sección a la izquierda; estado de conexión y
 * conmutador de tema a la derecha. Se mantiene fija sobre el área de contenido.
 */
export function Topbar(): ReactNode {
  const title = useSectionTitle();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 lg:px-6">
      <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        <ConnectionStatus />
        <ThemeToggle />
      </div>
    </header>
  );
}
