import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import type { ThemePreference } from './theme-context';
import { useTheme } from './use-theme';

interface Option {
  readonly value: ThemePreference;
  readonly label: string;
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const OPTIONS: readonly Option[] = [
  { value: 'system', label: 'Tema del sistema', Icon: Monitor },
  { value: 'light', label: 'Tema claro', Icon: Sun },
  { value: 'dark', label: 'Tema oscuro', Icon: Moon },
];

/**
 * Control segmentado de tema (sistema / claro / oscuro). Radix `ToggleGroup`
 * aporta selección única, tab-roving y flechas; cada opción lleva icono +
 * `aria-label`, así la identidad no depende solo del color.
 */
export function ThemeToggle(): ReactNode {
  const { preference, setPreference } = useTheme();

  return (
    <ToggleGroup.Root
      type="single"
      value={preference}
      onValueChange={(value) => {
        // El grupo emite '' al intentar deseleccionar; se ignora para mantener
        // siempre una opción activa.
        if (value === 'system' || value === 'light' || value === 'dark') {
          setPreference(value);
        }
      }}
      aria-label="Tema de la interfaz"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroup.Item
          key={value}
          value={value}
          aria-label={label}
          title={label}
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
