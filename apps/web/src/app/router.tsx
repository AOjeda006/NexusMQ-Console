import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '@/app/layout/app-shell';
import { ClusterPage } from '@/routes/cluster-page';
import { DashboardPage } from '@/routes/dashboard-page';
import { GroupsPage } from '@/routes/groups-page';
import { HistoryPage } from '@/routes/history-page';
import { NotFoundPage } from '@/routes/not-found-page';
import { SettingsPage } from '@/routes/settings-page';
import { TopicsPage } from '@/routes/topics-page';

/**
 * Router de la SPA. Una ruta de layout (`AppShell`) envuelve todas las vistas;
 * usa el *data router* de React Router v7 para poder añadir loaders/acciones
 * (capa de datos + guard de auth) en F2.2 sin reestructurar.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
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
