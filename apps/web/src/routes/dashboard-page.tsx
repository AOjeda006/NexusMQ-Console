import { LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';

import { PagePlaceholder } from '@/components/page-placeholder';

export function DashboardPage(): ReactNode {
  return (
    <PagePlaceholder
      Icon={LayoutDashboard}
      title="Dashboard vivo"
      description="Throughput, latencias p50/p99/p999, salud del cluster y estado Raft, todo en tiempo real vía SSE."
      phase="Fase 3"
    />
  );
}
