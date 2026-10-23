import { DEFAULT_DARK, DEFAULT_LIGHT, themes } from './themes'
import {
  THEME_IDS,
  type ThemeId,
  type ThemeMode,
  type ThemePreference,
} from './types'

const THEME_ID_SET: ReadonlySet<string> = new Set(THEME_IDS)

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_ID_SET.has(value)
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || isThemeId(value)
}

/** Auto follows the OS and maps to Ivory/Carbon unless a theme is chosen. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ThemeId {
  if (preference === 'auto') {
    return systemPrefersDark ? DEFAULT_DARK : DEFAULT_LIGHT
  }
  return preference
}

export function themeMode(themeId: ThemeId): ThemeMode {
  return themes[themeId].mode
}

export function isDarkTheme(themeId: ThemeId): boolean {
  return themeMode(themeId) === 'dark'
}

export function themeForId(themeId: ThemeId) {
  return themes[themeId]
}

export function defaultThemeForMode(mode: ThemeMode): ThemeId {
  return mode === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT
}
