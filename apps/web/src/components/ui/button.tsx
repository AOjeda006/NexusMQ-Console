import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  ghost: 'border border-border text-foreground hover:bg-muted',
  danger: 'bg-critical text-white hover:brightness-110',
};

/**
 * Botón base del sistema de diseño. Toma el color de los tokens (`bg-primary`,
 * `border-border`), foco AA visible y estado deshabilitado coherente. Por defecto
 * es `type="button"` para no disparar submits accidentales.
 */
export function Button({
  variant = 'primary',
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
