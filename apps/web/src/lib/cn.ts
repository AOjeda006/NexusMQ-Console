import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une clases condicionales (`clsx`) y resuelve conflictos de Tailwind
 * (`tailwind-merge`), para que la última utilidad gane. Uso idiomático en toda
 * la SPA: `cn('px-3', activo && 'bg-primary', props.className)`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
