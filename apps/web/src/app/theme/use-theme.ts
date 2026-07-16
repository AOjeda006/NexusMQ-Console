import { useContext } from 'react';

import { ThemeContext, type ThemeContextValue } from './theme-context';

/** Acceso al tema. Debe usarse dentro de `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  }
  return context;
}
