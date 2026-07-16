import { Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { PagePlaceholder } from '@/components/page-placeholder';

export function GroupsPage(): ReactNode {
  return (
    <PagePlaceholder
      Icon={Users}
      title="Grupos de consumo"
      description="Listar y describir grupos: miembros, offsets y lag real por partición."
      phase="Fase 3"
    />
  );
}
