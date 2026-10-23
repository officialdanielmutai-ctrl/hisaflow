import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  THEME_IDS,
  themes,
  type ThemeId,
  type ThemePreference,
} from '@hisaflow/theme'

const { state } = vi.hoisted(() => ({
  state: {
    preference: 'auto' as ThemePreference,
    resolved: 'ivory' as ThemeId,
    setPreference: vi.fn(),
  },
}))

vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({
    preference: state.preference,
    resolved: state.resolved,
    theme: 'light',
    themeId: state.resolved,
    themes: THEME_IDS.map((id) => themes[id]),
    setPreference: state.setPreference,
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}))

import { ThemePicker } from './ThemePicker'

describe('ThemePicker', () => {
  beforeEach(() => {
    state.preference = 'auto'
    state.resolved = 'ivory'
    state.setPreference.mockReset()
  })

  it('renders Auto plus every named theme as a radiogroup', () => {
    render(<ThemePicker />)

    const group = screen.getByRole('radiogroup', { name: 'Appearance theme' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(7)
    expect(screen.getByRole('radio', { name: /Auto/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    for (const id of THEME_IDS) {
      expect(
        screen.getByRole('radio', { name: new RegExp(themes[id].name) })
      ).toBeInTheDocument()
    }
  })

  it('selects a theme through the radio and exposes the selected state', () => {
    state.preference = 'carbon'
    state.resolved = 'carbon'
    render(<ThemePicker />)

    const carbon = screen.getByRole('radio', { name: /Carbon/ })
    expect(carbon).toHaveAttribute('aria-checked', 'true')
    expect(carbon).toHaveTextContent('Selected theme')

    fireEvent.click(screen.getByRole('radio', { name: /Savanna/ }))
    expect(state.setPreference).toHaveBeenCalledWith('savanna')
  })

  it('supports arrow-key navigation between theme cards', () => {
    render(<ThemePicker />)

    const auto = screen.getByRole('radio', { name: /Auto/ })
    auto.focus()
    fireEvent.keyDown(auto, { key: 'ArrowRight' })

    expect(state.setPreference).toHaveBeenCalledWith('ivory')
    expect(document.activeElement).toBe(
      screen.getByRole('radio', { name: /Ivory/ })
    )
  })

  it('moves backwards and wraps with the arrow keys', () => {
    render(<ThemePicker />)

    const auto = screen.getByRole('radio', { name: /Auto/ })
    auto.focus()
    fireEvent.keyDown(auto, { key: 'ArrowLeft' })

    expect(state.setPreference).toHaveBeenCalledWith('contrast')
    expect(document.activeElement).toBe(
      screen.getByRole('radio', { name: /Contrast/ })
    )
  })

  it('renders a scoped preview for the resolved Auto theme', () => {
    state.resolved = 'midnight'
    render(<ThemePicker />)

    const previews = document.querySelectorAll('[data-theme="midnight"]')
    expect(previews.length).toBeGreaterThan(0)
  })
})
