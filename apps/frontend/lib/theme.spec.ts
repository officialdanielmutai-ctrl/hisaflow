import { describe, it, expect } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
  readStoredPreference,
  resolvePrePaintState,
  resolvePreference,
  resolvePreferenceForSystem,
  resolveTheme,
  themeIdForMode,
} from './theme'

function storage(values: Record<string, string>): Pick<Storage, 'getItem'> {
  return {
    getItem: (key: string) => values[key] ?? null,
  }
}

describe('theme helpers', () => {
  it('accepts only light/dark modes for the compatibility helpers', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('system')).toBe(false)
    expect(isTheme('ivory')).toBe(false)
    expect(isTheme(null)).toBe(false)
    expect(isTheme(undefined)).toBe(false)
  })

  it('resolves named themes, auto and legacy modes into a safe preference', () => {
    expect(resolvePreference('ivory')).toBe('ivory')
    expect(resolvePreference('midnight')).toBe('midnight')
    expect(resolvePreference('auto')).toBe('auto')
    expect(resolvePreference('light')).toBe('ivory')
    expect(resolvePreference('dark')).toBe('carbon')
    expect(resolvePreference('purple')).toBe('auto')
    expect(resolvePreference('__proto__')).toBe('auto')
    expect(resolvePreference(null)).toBe('auto')
  })

  it('maps Auto to Ivory/Carbon and keeps explicit themes', () => {
    expect(resolvePreferenceForSystem('auto', false)).toBe('ivory')
    expect(resolvePreferenceForSystem('auto', true)).toBe('carbon')
    expect(resolvePreferenceForSystem('savanna', true)).toBe('savanna')
  })

  it('defaults the legacy mode helper to light and maps named themes', () => {
    expect(DEFAULT_THEME).toBe('light')
    expect(resolveTheme(null)).toBe('light')
    expect(resolveTheme('purple')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('midnight')).toBe('dark')
    expect(resolveTheme('savanna')).toBe('light')
  })

  it('toggles between light and dark default themes', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
    expect(themeIdForMode('light')).toBe('ivory')
    expect(themeIdForMode('dark')).toBe('carbon')
  })

  it('reads the new key first, migrates the legacy key and falls back safely', () => {
    expect(
      readStoredPreference(storage({ [THEME_STORAGE_KEY]: 'lagoon' }))
    ).toBe('lagoon')
    expect(readStoredPreference(storage({ 'hisaflow.theme': 'dark' }))).toBe(
      'carbon'
    )
    expect(readStoredPreference(storage({}))).toBeNull()
    expect(readStoredPreference(null)).toBeNull()
    expect(
      readStoredPreference({
        getItem: () => {
          throw new Error('blocked')
        },
      })
    ).toBeNull()
  })

  it('computes the pre-paint attributes for every mode', () => {
    expect(resolvePrePaintState('auto', false)).toEqual({
      themeId: 'ivory',
      mode: 'light',
      isDark: false,
    })
    expect(resolvePrePaintState('auto', true)).toEqual({
      themeId: 'carbon',
      mode: 'dark',
      isDark: true,
    })
    expect(resolvePrePaintState('midnight', false)).toEqual({
      themeId: 'midnight',
      mode: 'dark',
      isDark: true,
    })
  })

  it('bootstrap script validates ids, migrates and sets the theme before paint', () => {
    expect(THEME_STORAGE_KEY).toBe('hf-theme')
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY)
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('hisaflow.theme')
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('matchMedia')
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('dataset.theme')
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('classList.toggle')
  })
})
