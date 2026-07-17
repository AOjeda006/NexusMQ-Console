import { type ReactNode, useEffect, useRef } from 'react';
import uPlot from 'uplot';

import 'uplot/dist/uPlot.min.css';

/**
 * uPlot orientado a **streaming**: al contrario que el wrapper de F2.3 (que
 * reconstruye al cambiar los datos), este crea el plot una sola vez y va
 * empujando datos con `setData` en cada frame —sin recrear ni parpadear—, lo que
 * lo hace idóneo para series de alta frecuencia. Solo se reconstruye cuando
 * cambian las opciones (p. ej. al conmutar de tema, que llega como una nueva
 * `makeOptions`). El tamaño se sincroniza con `ResizeObserver`.
 */
export function LiveUplot({
  makeOptions,
  data,
  className,
  ariaLabel,
}: {
  readonly makeOptions: (width: number, height: number) => uPlot.Options;
  readonly data: uPlot.AlignedData;
  readonly className?: string;
  readonly ariaLabel?: string;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Crear/recrear el plot solo cuando cambian las opciones (tamaño inicial + tema).
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
    const plot = new uPlot(makeOptions(width, height), dataRef.current, element);
    plotRef.current = plot;
    const resizeObserver = new ResizeObserver(() => plot.setSize(measure()));
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [makeOptions]);

  // Empujar datos nuevos sin reconstruir: streaming fluido.
  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data]);

  return <div ref={containerRef} role="img" aria-label={ariaLabel} className={className} />;
}
