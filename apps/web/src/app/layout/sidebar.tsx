import { Waypoints } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';

import { NAV_ITEMS, type NavItem, SETTINGS_ITEM } from './nav';

/** Enlace de navegación. Estado activo por fondo + peso + barra de acento
 *  (nunca solo color), con nombre accesible estable en modo rail o expandido. */
function SidebarLink({ item }: { item: NavItem }): ReactNode {
  const { path, label, Icon, end } = item;
  return (
    <NavLink
      to={path}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          isActive
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary"
            />
          )}
          <Icon
            aria-hidden
            className={cn('size-5 shrink-0', isActive ? 'text-primary' : 'text-current')}
          />
          <span className="hidden lg:block">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Barra lateral de navegación. Rail de iconos por defecto (móvil/estrecho) que
 * se expande con etiquetas a partir de `lg`; `Ajustes` queda anclado abajo.
 */
export function Sidebar(): ReactNode {
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-border bg-surface px-2 py-3 lg:w-60 lg:px-3">
      <NavLink
        to="/"
        aria-label="NexusMQ Console — inicio"
        className="mb-4 flex items-center gap-2.5 rounded-md px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Waypoints aria-hidden className="size-5" />
        </span>
        <span className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="truncate text-sm font-semibold text-foreground">NexusMQ</span>
          <span className="truncate text-xs text-muted-foreground">Console</span>
        </span>
      </NavLink>

      <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
        <div className="mt-auto border-t border-border pt-1">
          <SidebarLink item={SETTINGS_ITEM} />
        </div>
      </nav>
    </aside>
  );
}
