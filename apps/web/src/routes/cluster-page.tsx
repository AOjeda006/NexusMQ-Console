import { Network } from 'lucide-react';
import type { ReactNode } from 'react';

import { PagePlaceholder } from '@/components/page-placeholder';

export function ClusterPage(): ReactNode {
  return (
    <PagePlaceholder
      Icon={Network}
      title="Cluster / Raft"
      description="Nodos, roles, term, commit index y líder por partición, con una topología en 3D como pieza central."
      phase="Fase 3"
    />
  );
}
