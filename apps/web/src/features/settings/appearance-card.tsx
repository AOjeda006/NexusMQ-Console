import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import type { ThemePreference } from '@/app/theme/theme-context';
import { useTheme } from '@/app/theme/use-theme';
import { cn } from '@/lib/cn';

interface Option {
  readonly value: ThemePreference;
  readonly label: string;
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const OPTIONS: readonly Option[] = [
  { value: 'system', label: 'Sistema', Icon: Monitor },
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
];

/** Ajuste de tema (con etiquetas). Persiste vía `ThemeProvider` (localStorage). */
export function AppearanceCard(): ReactNode {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="text-sm font-medium text-foreground">Apariencia</h2>
        <p className="text-xs text-muted-foreground">
          Tema de la consola. «Sistema» sigue el ajuste del sistema operativo (ahora: {resolved}).
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Tema de la interfaz"
        className="inline-flex flex-wrap gap-2"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference(value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
