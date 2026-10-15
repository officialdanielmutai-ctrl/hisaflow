'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

/**
 * Light/dark switch for Settings → Appearance. Controls the manual theme
 * preference persisted by `ThemeProvider` (Settings, not the OS).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-base)] p-1"
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={!isDark}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          !isDark
            ? 'bg-[var(--color-bg-surface)] text-[var(--color-accent)] shadow-sm'
            : 'text-[var(--color-text-muted)]'
        }`}
        title="Light mode"
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Light mode</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={isDark}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          isDark
            ? 'bg-[var(--color-bg-surface)] text-[var(--color-accent)] shadow-sm'
            : 'text-[var(--color-text-muted)]'
        }`}
        title="Dark mode"
      >
        <Moon className="h-4 w-4" />
        <span className="sr-only">Dark mode</span>
      </button>
    </div>
  );
}
