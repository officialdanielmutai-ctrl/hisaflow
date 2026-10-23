import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import { ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { preference, themeId, theme, themes, setPreference, setTheme } =
    useTheme()
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="theme-id">{themeId}</span>
      <span data-testid="mode">{theme}</span>
      <span data-testid="theme-count">{themes.length}</span>
      <button type="button" onClick={() => setPreference('midnight')}>
        Midnight
      </button>
      <button type="button" onClick={() => setPreference('auto')}>
        Auto
      </button>
      <button type="button" onClick={() => setTheme('dark')}>
        Dark
      </button>
    </div>
  )
}

function installMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const media = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (
      _: string,
      listener: (event: MediaQueryListEvent) => void
    ) => {
      listeners.add(listener)
    },
    removeEventListener: (
      _: string,
      listener: (event: MediaQueryListEvent) => void
    ) => {
      listeners.delete(listener)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => media),
  })

  return {
    setMatches(next: boolean) {
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent)
      }
    },
  }
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.cookie = 'hf-theme=; path=/; max-age=0'
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme-preference')
    const existing = document.querySelector('meta[name="theme-color"]')
    existing?.remove()
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#FAF7F2'
    document.head.appendChild(meta)
  })

  it('defaults to Auto and resolves Ivory when the system is light', async () => {
    installMatchMedia(false)
    render(
      <ThemeProvider initialPreference="auto">
        <Probe />
      </ThemeProvider>
    )

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('ivory')
    )
    expect(screen.getByTestId('preference')).toHaveTextContent('auto')
    expect(screen.getByTestId('theme-id')).toHaveTextContent('ivory')
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(screen.getByTestId('theme-count')).toHaveTextContent('6')
  })

  it('applies, persists and mirrors a named theme in localStorage and cookie', async () => {
    installMatchMedia(false)
    render(
      <ThemeProvider initialPreference="auto">
        <Probe />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Midnight' }))

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('midnight')
    )
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('midnight')
    expect(document.cookie).toContain('hf-theme=midnight')
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content')
    ).toBe('#000000')
    expect(screen.getByTestId('preference')).toHaveTextContent('midnight')
  })

  it('migrates the legacy light/dark key to Carbon/Ivory', async () => {
    installMatchMedia(false)
    window.localStorage.setItem('hisaflow.theme', 'dark')
    render(
      <ThemeProvider initialPreference="auto">
        <Probe />
      </ThemeProvider>
    )

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('carbon')
    )
    expect(screen.getByTestId('preference')).toHaveTextContent('carbon')
  })

  it('falls back to Auto for corrupt storage', async () => {
    installMatchMedia(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
    render(
      <ThemeProvider initialPreference="carbon">
        <Probe />
      </ThemeProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('preference')).toHaveTextContent('auto')
    )
    expect(document.documentElement.dataset.theme).toBe('ivory')
  })

  it('follows system preference changes while on Auto', async () => {
    const media = installMatchMedia(false)
    render(
      <ThemeProvider initialPreference="auto">
        <Probe />
      </ThemeProvider>
    )

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('ivory')
    )

    media.setMatches(true)

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('carbon')
    )
  })

  it('mirrors cross-tab storage changes', async () => {
    installMatchMedia(false)
    render(
      <ThemeProvider initialPreference="auto">
        <Probe />
      </ThemeProvider>
    )

    window.localStorage.setItem(THEME_STORAGE_KEY, 'lagoon')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'lagoon',
      })
    )

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('lagoon')
    )
    expect(screen.getByTestId('preference')).toHaveTextContent('lagoon')
  })

  it('maps the legacy quick toggle onto Carbon and Ivory', async () => {
    installMatchMedia(false)
    render(
      <ThemeProvider initialPreference="ivory">
        <Probe />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('carbon')
    )
    expect(screen.getByTestId('preference')).toHaveTextContent('carbon')
  })

  it('still works when localStorage throws', async () => {
    installMatchMedia(false)
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })

    render(
      <ThemeProvider initialPreference="savanna">
        <Probe />
      </ThemeProvider>
    )

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('savanna')
    )

    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})
