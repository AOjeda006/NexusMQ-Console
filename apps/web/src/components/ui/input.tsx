import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Campo de formulario: etiqueta asociada por `id`, control y una línea de ayuda
 * opcional (o de error, con color de estado `critical` + texto). Genera el `id`
 * si no se pasa, para que `label`/control queden siempre enlazados (accesible).
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly htmlFor: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error !== undefined ? (
        <p className="text-xs text-critical">{error}</p>
      ) : hint !== undefined ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Input base del sistema de diseño (tokens + foco AA visible). */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-foreground',
        'placeholder:text-faint-foreground',
        'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
