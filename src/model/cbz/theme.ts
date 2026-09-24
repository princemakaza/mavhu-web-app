// Standalone theme controller so the CBZ shell can flip data-theme on <html>
// without depending on the legacy Mavhu ThemeProvider (which lives inside the
// old SessionContext). Persists to localStorage under a CBZ-specific key so we
// don't collide with the Mavhu identity flow's key.

import { useEffect, useState } from 'react';

export type CbzTheme = 'light' | 'dark';

const KEY = 'cbz.theme';

function readInitial(): CbzTheme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: CbzTheme): void {
  document.documentElement.dataset.cbzTheme = theme;
  document.documentElement.dataset.theme = theme;
}

export function useCbzTheme(): { theme: CbzTheme; toggle: () => void; setTheme: (t: CbzTheme) => void } {
  const [theme, setThemeState] = useState<CbzTheme>(readInitial);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // storage unavailable — theme stays in-memory for the tab
    }
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((current) => (current === 'light' ? 'dark' : 'light')),
  };
}
