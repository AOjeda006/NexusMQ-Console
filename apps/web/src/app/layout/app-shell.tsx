import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Marco de la aplicación: barra lateral fija + barra superior + área de
 * contenido con scroll propio (`Outlet`). El resto de vistas se montan dentro.
 */
export function AppShell(): ReactNode {
  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-page">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
