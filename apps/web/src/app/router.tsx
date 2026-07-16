import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '@/app/layout/app-shell';
import { RequireAuth } from '@/features/auth/require-auth';
import { ClusterPage } from '@/routes/cluster-page';
import { DashboardPage } from '@/routes/dashboard-page';
import { GroupsPage } from '@/routes/groups-page';
import { HistoryPage } from '@/routes/history-page';
import { LoginPage } from '@/routes/login-page';
import { NotFoundPage } from '@/routes/not-found-page';
import { SettingsPage } from '@/routes/settings-page';
import { TopicsPage } from '@/routes/topics-page';

/**
 * Router de la SPA. `/login` vive fuera del shell; el resto queda tras el guard
 * `RequireAuth`, que resuelve el estado de acceso (sesión + modo del broker)
 * antes de montar el `AppShell`. Data router de React Router v7 para poder
 * añadir loaders/acciones más adelante sin reestructurar.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Laboratorio de visualización (F2.3): fuera del shell y del guard, y con carga
  // diferida para no inflar el bundle principal con ECharts/three.
  {
    path: '/lab',
    lazy: async () => ({ Component: (await import('@/routes/viz-lab-page')).VizLabPage }),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'topics', element: <TopicsPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'cluster', element: <ClusterPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
