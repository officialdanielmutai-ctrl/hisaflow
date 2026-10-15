/**
 * Theme preference helpers.
 *
 * The app supports a manual light/dark toggle (Settings → Appearance). The
 * preference is persisted in `localStorage` and applied by adding/removing the
 * `dark` class on `<html>`; `globals.css` maps the design tokens for that
 * class. These helpers are pure so they can be unit-tested without a DOM.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'hisaflow.theme';
export const DEFAULT_THEME: Theme = 'light';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Coerces a stored value (which may be null, junk, or a legacy value). */
export function resolveTheme(stored: unknown): Theme {
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/**
 * The inline bootstrap script. It runs before React hydrates so the correct
 * theme is on `<html>` before the first paint (no light-mode flash).
 * Kept as a string so `layout.tsx` can inject it with `dangerouslySetInnerHTML`.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var d=s==='dark';var r=document.documentElement;r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
