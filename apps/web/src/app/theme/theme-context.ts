import { createContext } from 'react';

/** Preferencia elegida por el usuario. `system` sigue el ajuste del SO. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Tema efectivo tras resolver `system` contra el SO. Lo consumen las gráficas. */
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** Preferencia persistida (`system` | `light` | `dark`). */
  readonly preference: ThemePreference;
  /** Tema realmente aplicado al documento. */
  readonly resolved: ResolvedTheme;
  /** Cambia la preferencia y la persiste. */
  setPreference(preference: ThemePreference): void;
}

/** Clave de `localStorage` compartida con el script anti-FOUC de `index.html`. */
export const THEME_STORAGE_KEY = 'nexusmq.theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
