import {
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Network,
  LineChart,
  Settings,
  Users,
} from 'lucide-react';

/** Un destino de navegación de la consola. */
export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  /** Coincidencia exacta (para la raíz, que si no queda siempre activa). */
  readonly end?: boolean;
}

/** Secciones principales (barra lateral). El orden es el de la navegación. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { path: '/topics', label: 'Topics', Icon: Layers },
  { path: '/groups', label: 'Grupos', Icon: Users },
  { path: '/cluster', label: 'Cluster', Icon: Network },
  { path: '/history', label: 'Historia', Icon: LineChart },
];

/** Ajustes va anclado abajo, separado de las secciones de datos. */
export const SETTINGS_ITEM: NavItem = { path: '/settings', label: 'Ajustes', Icon: Settings };
