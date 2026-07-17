import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { RANGE_PRESETS, type RangePreset } from './history-range';

/**
 * Selector de ventana temporal (radiogroup accesible) + acción de refrescar. Es
 * el único control de filtro y va en una fila **sobre** las gráficas, como pide
 * la skill dataviz. La selección marca el preset activo (identidad por etiqueta,
 * no solo color).
 */
export function RangeSelector({
  value,
  onSelect,
  onRefresh,
  disabled = false,
}: {
  readonly value: RangePreset;
  readonly onSelect: (preset: RangePreset) => void;
  readonly onRefresh: () => void;
  readonly disabled?: boolean;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="radiogroup"
        aria-label="Ventana temporal"
        className="inline-flex flex-wrap gap-2"
        data-testid="history-range"
      >
        {RANGE_PRESETS.map((preset) => {
          const selected = preset.id === value.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(preset)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RefreshCw aria-hidden className="size-4" />
        Actualizar
      </button>
    </div>
  );
}
