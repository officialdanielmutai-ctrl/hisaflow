'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  nextTheme,
  resolveTheme,
  type Theme,
} from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/**
 * Applies and persists the manual theme preference. The initial value is set by
 * the no-flash bootstrap script in `app/layout.tsx`; this provider keeps React
 * state in sync with that value and writes changes back.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // On mount, adopt whatever the bootstrap script already applied.
  useEffect(() => {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial = resolveTheme(stored);
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the in-memory value still applies.
    }
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(nextTheme(theme));
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
