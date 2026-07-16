import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
  type ResolvedTheme,
  ThemeContext,
  type ThemeContextValue,
  type ThemePreference,
  THEME_STORAGE_KEY,
} from './theme-context';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Lee la preferencia persistida; `system` si no hay nada o falla el storage. */
function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Provee el tema a la app y lo **aplica al documento**: `light`/`dark` estampan
 * `data-theme` (que gana al ajuste del SO); `system` lo retira y deja mandar al
 * `@media` de los tokens. Persiste la preferencia y reacciona a cambios del SO
 * mientras se está en `system`.
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(systemTheme);

  // Sigue el ajuste del SO para poder resolver `system` en vivo.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setSystemResolved(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? systemResolved : preference;

  // Refleja la preferencia en el atributo del documento.
  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference): void => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage no disponible: el tema vive solo en memoria esta sesión */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
