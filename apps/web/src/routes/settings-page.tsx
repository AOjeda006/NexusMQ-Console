import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';

import { PagePlaceholder } from '@/components/page-placeholder';

export function SettingsPage(): ReactNode {
  return (
    <PagePlaceholder
      Icon={Settings}
      title="Ajustes"
      description="Perfiles de conexión (host/puerto admin), tema y gestión de la sesión con el broker."
      phase="Fase 3"
    />
  );
}
