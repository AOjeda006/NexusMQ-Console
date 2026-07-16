import { Layers } from 'lucide-react';
import type { ReactNode } from 'react';

import { PagePlaceholder } from '@/components/page-placeholder';

export function TopicsPage(): ReactNode {
  return (
    <PagePlaceholder
      Icon={Layers}
      title="Topics"
      description="Listar (paginado), crear, describir particiones, borrar y editar la retención (PATCH) contra el broker."
      phase="Fase 3"
    />
  );
}
