/**
 * Frontend theme helpers.
 *
 * The theme contract itself lives in `@hisaflow/theme`. This module owns the
 * browser-specific pieces: storage/cookie keys, legacy migration, the
 * no-flash bootstrap script and the small pure helpers used by tests.
 */

import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_IDS,
  isThemeId,
  isThemePreference,
  resolveTheme as resolveThemeId,
  themeForId,
  themes,
  type ThemeDefinition,
  type ThemeId,
  type ThemeMode,
  type ThemePreference,
} from '@hisaflow/theme'

export type Theme = ThemeMode

/** Directive key. The old key is read once and migrated. */
export const THEME_STORAGE_KEY = 'hf-theme'
export const THEME_COOKIE_KEY = 'hf-theme'
export const LEGACY_THEME_STORAGE_KEY = 'hisaflow.theme'

export const DEFAULT_THEME: Theme = 'light'
export const DEFAULT_THEME_ID: ThemeId = DEFAULT_LIGHT
export const DARK_THEME_ID: ThemeId = DEFAULT_DARK

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

/** Maps a mode to its default named theme (Ivory/Carbon). */
export function themeIdForMode(mode: ThemeMode): ThemeId {
  return mode === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT
}

/**
 * Coerces any stored value — named theme, Auto, legacy `light`/`dark`, junk,
 * null — into a safe preference. Corrupt values fall back to Auto.
 */
export function resolvePreference(value: unknown): ThemePreference {
  if (isThemePreference(value)) return value
  if (value === 'light') return DEFAULT_LIGHT
  if (value === 'dark') return DEFAULT_DARK
  return 'auto'
}

/** Backwards-compatible mode resolver for existing consumers. */
export function resolveTheme(stored: unknown): Theme {
  const preference = resolvePreference(stored)
  if (preference === 'auto') return DEFAULT_THEME
  return themeForId(preference).mode
}

export function resolvePreferenceForSystem(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ThemeId {
  return resolveThemeId(preference, systemPrefersDark)
}

export function resolveThemeDefinition(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ThemeDefinition {
  return themes[resolvePreferenceForSystem(preference, systemPrefersDark)]
}

/** Pure mirror of the pre-paint script's decision, used by the test suite. */
export function resolvePrePaintState(
  preference: ThemePreference,
  systemPrefersDark: boolean
): { themeId: ThemeId; mode: ThemeMode; isDark: boolean } {
  const themeId = resolvePreferenceForSystem(preference, systemPrefersDark)
  const mode = themeForId(themeId).mode
  return { themeId, mode, isDark: mode === 'dark' }
}

export function readStoredPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined
): ThemePreference | null {
  if (!storage) return null
  try {
    const current = storage.getItem(THEME_STORAGE_KEY)
    if (current !== null) return resolvePreference(current)
    const legacy = storage.getItem(LEGACY_THEME_STORAGE_KEY)
    if (legacy !== null) return resolvePreference(legacy)
  } catch {
    // Storage can be unavailable in private mode / blocked contexts.
  }
  return null
}

export function systemPrefersDark(
  media: Pick<MediaQueryList, 'matches'> | null | undefined
): boolean {
  return media?.matches === true
}

const BOOTSTRAP_THEMES = Object.fromEntries(
  THEME_IDS.map((id) => [
    id,
    { mode: themes[id].mode, canvas: themes[id].colors.bg.canvas },
  ])
)

/**
 * The inline bootstrap script. It runs before React hydrates so the right
 * named theme is on `<html>` before first paint (no flash, including for Auto).
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var ids=${JSON.stringify(
  THEME_IDS
)};var map=${JSON.stringify(
  BOOTSTRAP_THEMES
)};var k='${THEME_STORAGE_KEY}';var lk='${LEGACY_THEME_STORAGE_KEY}';var s=null;try{s=localStorage.getItem(k);if(s===null){s=localStorage.getItem(lk);}}catch(e){}if(s==='light'){s='${DEFAULT_LIGHT}';}else if(s==='dark'){s='${DEFAULT_DARK}';}var ok=s==='auto'||ids.indexOf(s)>-1;if(!ok){s='auto';}try{var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='auto'?(dark?'${DEFAULT_DARK}':'${DEFAULT_LIGHT}'):s;var meta=map[t]||map['${DEFAULT_LIGHT}'];var r=document.documentElement;r.dataset.theme=t;r.dataset.themePreference=s;r.classList.toggle('dark',meta.mode==='dark');r.style.colorScheme=meta.mode;var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',meta.canvas);}}catch(e){}})();`

export { isThemeId, isThemePreference, themes }
export type { ThemeDefinition, ThemeId, ThemePreference }
