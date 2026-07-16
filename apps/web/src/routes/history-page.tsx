import { LineChart } from 'lucide-react';
import type { ReactNode } from 'react';

import { PagePlaceholder } from '@/components/page-placeholder';

export function HistoryPage(): ReactNode {
  return (
    <PagePlaceholder
      Icon={LineChart}
      title="Historia"
      description="Series temporales de percentiles y throughput vía Prometheus (query_range), con degradación limpia si no está."
      phase="Fase 4"
    />
  );
}
