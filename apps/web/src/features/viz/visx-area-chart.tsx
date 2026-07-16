import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath } from '@visx/shape';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import type { VizTokens } from './use-viz-tokens';

/** Punto de la serie (x monótona, y ≥ 0). */
export interface VisxPoint {
  readonly x: number;
  readonly y: number;
}

const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 } as const;
const AREA_GRADIENT_ID = 'visx-area-gradient';

/**
 * Wrapper base de **visx** (composición SVG): un área con línea que toma color de
 * los tokens dataviz —serie 1 para el trazo, degradado sutil para el relleno— y
 * rejilla/ejes recesivos. Al ser SVG usa los hex resueltos que le pasa el
 * llamador; se re-renderiza y re-colorea al cambiar de tema. Responsive por
 * medición del contenedor.
 */
export function VisxAreaChart({
  data,
  tokens,
  className,
  ariaLabel,
}: {
  readonly data: readonly VisxPoint[];
  readonly tokens: VizTokens;
  readonly className?: string;
  readonly ariaLabel?: string;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setWidth(Math.floor(element.getBoundingClientRect().width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const stroke = tokens.series[0] ?? tokens.primary;

  const xScale = scaleLinear<number>({
    domain: [data[0]?.x ?? 0, data[data.length - 1]?.x ?? 1],
    range: [0, innerWidth],
  });
  const yScale = scaleLinear<number>({
    domain: [0, Math.max(1, ...data.map((point) => point.y))],
    range: [innerHeight, 0],
    nice: true,
  });

  return (
    <div ref={containerRef} className={className}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel}>
          <LinearGradient
            id={AREA_GRADIENT_ID}
            from={stroke}
            to={stroke}
            fromOpacity={0.28}
            toOpacity={0.02}
          />
          <Group left={MARGIN.left} top={MARGIN.top}>
            {yScale.ticks(4).map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={innerWidth}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke={tokens.grid}
                strokeWidth={1}
              />
            ))}
            <AreaClosed<VisxPoint>
              data={data as VisxPoint[]}
              x={(point) => xScale(point.x)}
              y={(point) => yScale(point.y)}
              yScale={yScale}
              fill={`url(#${AREA_GRADIENT_ID})`}
              stroke="transparent"
            />
            <LinePath<VisxPoint>
              data={data as VisxPoint[]}
              x={(point) => xScale(point.x)}
              y={(point) => yScale(point.y)}
              stroke={stroke}
              strokeWidth={2}
            />
            <AxisLeft
              scale={yScale}
              numTicks={4}
              stroke={tokens.axis}
              tickStroke={tokens.axis}
              tickLabelProps={() => ({
                fill: tokens.mutedForeground,
                fontSize: 10,
                textAnchor: 'end',
                dx: -4,
                dy: 3,
              })}
            />
            <AxisBottom
              top={innerHeight}
              scale={xScale}
              numTicks={5}
              stroke={tokens.axis}
              tickStroke={tokens.axis}
              tickLabelProps={() => ({
                fill: tokens.mutedForeground,
                fontSize: 10,
                textAnchor: 'middle',
                dy: 2,
              })}
            />
          </Group>
        </svg>
      )}
    </div>
  );
}
