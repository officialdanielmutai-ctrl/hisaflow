'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  THEME_IDS,
  themeForId,
  themes,
  type ThemeDefinition,
  type ThemeId,
  type ThemePreference,
} from '@hisaflow/theme'
import {
  DEFAULT_THEME,
  THEME_COOKIE_KEY,
  THEME_STORAGE_KEY,
  readStoredPreference,
  resolvePreference,
  resolvePreferenceForSystem,
  systemPrefersDark,
  themeIdForMode,
  type Theme,
} from '@/lib/theme'

interface ThemeContextValue {
  /** Resolved mode, kept for existing light/dark consumers. */
  theme: Theme
  /** Resolved named theme. */
  themeId: ThemeId
  resolved: ThemeId
  preference: ThemePreference
  themes: ThemeDefinition[]
  setPreference: (preference: ThemePreference) => void
  /** Quick toggle: chooses the default named theme for the mode. */
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function writeCookie(preference: ThemePreference) {
  if (typeof document === 'undefined') return
  try {
    document.cookie = `${THEME_COOKIE_KEY}=${preference}; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // Cookies can be disabled; localStorage + the in-memory value still work.
  }
}

function writeStorage(preference: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode); the in-memory value still applies.
  }
}

function safeStorage(): Pick<Storage, 'getItem'> | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function applyTheme(preference: ThemePreference, prefersDark: boolean) {
  if (typeof document === 'undefined') return
  const themeId = resolvePreferenceForSystem(preference, prefersDark)
  const definition = themeForId(themeId)
  const root = document.documentElement

  root.dataset.theme = themeId
  root.dataset.themePreference = preference
  root.classList.toggle('dark', definition.mode === 'dark')
  root.classList.toggle('light', definition.mode === 'light')
  root.style.colorScheme = definition.mode

  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  )
  if (meta) meta.content = definition.colors.bg.canvas
}

/**
 * Named-theme provider. The server renders the cookie's theme (or the light
 * default for Auto); this provider adopts localStorage, keeps the cookie in
 * sync, follows OS changes while on Auto, and updates cross-tab.
 */
export function ThemeProvider({
  children,
  initialPreference = 'auto',
}: {
  children: React.ReactNode
  initialPreference?: ThemePreference
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    resolvePreference(initialPreference)
  )
  const [prefersDark, setPrefersDark] = useState(false)

  const applyPreference = useCallback(
    (next: ThemePreference, nextPrefersDark: boolean) => {
      setPreferenceState(next)
      applyTheme(next, nextPrefersDark)
    },
    []
  )

  useEffect(() => {
    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    const dark = systemPrefersDark(media)
    setPrefersDark(dark)

    const stored = readStoredPreference(safeStorage())
    const next = stored ?? resolvePreference(initialPreference)
    applyPreference(next, dark)
    if (stored !== null) {
      writeCookie(next)
      writeStorage(next)
    }

    const onMediaChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches)
      applyTheme(
        readStoredPreference(safeStorage()) ??
          resolvePreference(initialPreference),
        event.matches
      )
    }
    media?.addEventListener('change', onMediaChange)

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return
      const nextFromStorage = resolvePreference(event.newValue)
      applyPreference(nextFromStorage, systemPrefersDark(media))
    }
    window.addEventListener('storage', onStorage)

    return () => {
      media?.removeEventListener('change', onMediaChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [applyPreference, initialPreference])

  const setPreference = useCallback(
    (next: ThemePreference) => {
      const safe = resolvePreference(next)
      const media =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-color-scheme: dark)')
          : null
      const dark = systemPrefersDark(media)
      setPrefersDark(dark)
      applyPreference(safe, dark)
      writeStorage(safe)
      writeCookie(safe)
    },
    [applyPreference]
  )

  const setTheme = useCallback(
    (next: Theme) => setPreference(themeIdForMode(next)),
    [setPreference]
  )

  const themeId = resolvePreferenceForSystem(preference, prefersDark)
  const resolved = themeId
  const theme = themeForId(themeId).mode || DEFAULT_THEME

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeId,
      resolved,
      preference,
      themes: THEME_IDS.map((id) => themes[id]),
      setPreference,
      setTheme,
      toggleTheme,
    }),
    [theme, themeId, resolved, preference, setPreference, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
