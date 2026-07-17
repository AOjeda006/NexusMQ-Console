import { useEffect, useState } from 'react';

/**
 * Valores resueltos de los tokens de la skill dataviz que consumen las gráficas.
 * Las librerías (ECharts, uPlot, react-three-fiber) trabajan con colores en
 * canvas/WebGL, así que no pueden usar utilidades CSS: leen aquí el **hex ya
 * resuelto** para el tema activo. visx, al ser SVG, podría usar `var(--…)`, pero
 * comparte este puente por coherencia.
 */
export interface VizTokens {
  /** Paleta categórica en orden fijo (nunca cíclico): `--series-1..8`. */
  readonly series: readonly string[];
  readonly grid: string;
  readonly axis: string;
  readonly foreground: string;
  readonly mutedForeground: string;
  readonly surface: string;
  readonly primary: string;
  /** Colores de estado (fijos en ambos temas), para señales de salud en viz. */
  readonly success: string;
  readonly warning: string;
  readonly critical: string;
}

const SERIES_COUNT = 8;

function readTokens(): VizTokens {
  const style = getComputedStyle(document.documentElement);
  const value = (name: string): string => style.getPropertyValue(name).trim();
  return {
    series: Array.from({ length: SERIES_COUNT }, (_, i) => value(`--series-${i + 1}`)),
    grid: value('--grid'),
    axis: value('--axis'),
    foreground: value('--foreground'),
    mutedForeground: value('--muted-foreground'),
    surface: value('--surface'),
    primary: value('--primary'),
    success: value('--success'),
    warning: value('--warning'),
    critical: value('--critical'),
  };
}

/**
 * Lee los tokens dataviz resueltos y los **re-lee cuando cambia el tema**. En vez
 * de depender del orden de efectos de React, observa el atributo `data-theme` del
 * `:root` (que fija el `ThemeProvider`) y el media query del sistema; ante
 * cualquier cambio re-lee en el siguiente frame, cuando el estilo ya está
 * recalculado. Así cualquier gráfica reasigna sus colores al conmutar de tema.
 */
export function useVizTokens(): VizTokens {
  const [tokens, setTokens] = useState<VizTokens>(readTokens);

  useEffect(() => {
    let frame = 0;
    const update = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTokens(readTokens()));
    };

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    update();

    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return tokens;
}
