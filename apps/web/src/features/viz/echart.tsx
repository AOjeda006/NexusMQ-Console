import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { type ReactNode, useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * Wrapper base de **ECharts**: gestiona ciclo de vida (init/dispose), reajuste al
 * tamaño del contenedor (`ResizeObserver`) y reaplica la opción cuando cambia
 * (`notMerge` para que un cambio de tema reasigne todos los colores). El color lo
 * pone la opción, que el llamador construye desde los tokens dataviz.
 */
export function EChart({
  option,
  className,
  ariaLabel,
}: {
  readonly option: EChartsOption;
  readonly className?: string;
  readonly ariaLabel?: string;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={cn('h-full w-full', className)}
    />
  );
}
