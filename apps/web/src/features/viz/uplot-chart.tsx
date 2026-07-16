import { type ReactNode, useEffect, useRef } from 'react';
import uPlot from 'uplot';

import 'uplot/dist/uPlot.min.css';

/**
 * Wrapper base de **uPlot** (series temporales de alto rendimiento). uPlot es
 * imperativo y no reestiliza en caliente, así que el plot se **reconstruye**
 * cuando cambian sus opciones o datos —incluido el cambio de tema, que llega
 * como una nueva `makeOptions`—. El tamaño se sincroniza con `ResizeObserver`.
 */
export function UplotChart({
  makeOptions,
  data,
  className,
  ariaLabel,
}: {
  /** Construye las opciones a partir del tamaño disponible (colores ya resueltos). */
  readonly makeOptions: (width: number, height: number) => uPlot.Options;
  readonly data: uPlot.AlignedData;
  readonly className?: string;
  readonly ariaLabel?: string;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const measure = (): { width: number; height: number } => {
      const rect = element.getBoundingClientRect();
      return {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      };
    };

    const { width, height } = measure();
    const plot = new uPlot(makeOptions(width, height), data, element);
    const resizeObserver = new ResizeObserver(() => plot.setSize(measure()));
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      plot.destroy();
    };
  }, [makeOptions, data]);

  return <div ref={containerRef} role="img" aria-label={ariaLabel} className={className} />;
}
