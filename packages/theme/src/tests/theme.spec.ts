import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_IDS,
  TOKEN_VARS,
  contrastRatio,
  generateThemeCss,
  isThemeId,
  isThemePreference,
  resolveTheme,
  themes,
  token,
  type ThemeDefinition,
} from '../index'

function pair(
  label: string,
  foreground: string,
  background: string,
  minimum: number
): void {
  assert.ok(
    contrastRatio(foreground, background) >= minimum,
    `${label} contrast ${contrastRatio(foreground, background).toFixed(2)} is below ${minimum}`
  )
}

function eachTheme(run: (theme: ThemeDefinition) => void): void {
  for (const id of THEME_IDS) run(themes[id])
}

test('every launch theme defines the complete contract', () => {
  assert.deepEqual(THEME_IDS, [
    'ivory',
    'carbon',
    'savanna',
    'midnight',
    'lagoon',
    'contrast',
  ])

  eachTheme((theme) => {
    assert.equal(theme.id, theme.id.toLowerCase())
    assert.ok(theme.name.length > 0)
    assert.ok(theme.description.length > 0)
    assert.ok(theme.colors.chart.length >= 8)
    assert.ok(Number.isFinite(theme.iconStroke))
  })
})

test('resolveTheme truth table covers auto and explicit choices', () => {
  assert.equal(resolveTheme('auto', false), DEFAULT_LIGHT)
  assert.equal(resolveTheme('auto', true), DEFAULT_DARK)
  assert.equal(resolveTheme('ivory', true), 'ivory')
  assert.equal(resolveTheme('carbon', false), 'carbon')
  assert.equal(resolveTheme('contrast', true), 'contrast')
  assert.equal(DEFAULT_LIGHT, 'ivory')
  assert.equal(DEFAULT_DARK, 'carbon')
})

test('theme guards reject garbage and prototype keys', () => {
  assert.equal(isThemeId('ivory'), true)
  assert.equal(isThemeId('Ivory'), false)
  assert.equal(isThemeId('purple'), false)
  assert.equal(isThemeId(null), false)
  assert.equal(isThemeId(undefined), false)
  assert.equal(isThemeId(12), false)
  assert.equal(isThemeId('__proto__'), false)
  assert.equal(isThemeId('constructor'), false)
  assert.equal(isThemePreference('auto'), true)
  assert.equal(isThemePreference('ivory'), true)
  assert.equal(isThemePreference('system'), false)
})

test('token accessor values exist for every theme in the generated CSS', () => {
  const css = generateThemeCss()
  for (const variable of Object.values(TOKEN_VARS)) {
    assert.ok(
      css.includes(`${variable}:`),
      `${variable} is missing from generated CSS`
    )
  }
  assert.equal(token('bg.surface'), 'var(--hf-bg-surface)')
  assert.equal(token('radius.card'), 'var(--hf-radius-card)')
  assert.equal(token('motion.durationBase'), 'var(--hf-motion-duration-base)')
})

test('generated CSS is deterministic and covers each theme selector', () => {
  const first = generateThemeCss()
  const second = generateThemeCss()
  assert.equal(first, second)
  for (const id of THEME_IDS) {
    assert.ok(first.includes(`html[data-theme="${id}"]`), `missing ${id} block`)
  }
  assert.ok(first.includes('@media (prefers-reduced-motion: reduce)'))
  assert.ok(first.includes('@media print'))
})

test('generated CSS matches the committed frontend stylesheet', () => {
  const path = join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'apps',
    'frontend',
    'app',
    'theme-tokens.generated.css'
  )
  const committed = readFileSync(path, 'utf8')
  assert.equal(committed, generateThemeCss())
})

test('body and secondary text meet AA in every theme (AAA in Contrast)', () => {
  eachTheme((theme) => {
    const minimum = theme.id === 'contrast' ? 7 : 4.5
    pair(
      'primary/canvas',
      theme.colors.text.primary,
      theme.colors.bg.canvas,
      minimum
    )
    pair(
      'primary/surface',
      theme.colors.text.primary,
      theme.colors.bg.surface,
      minimum
    )
    pair(
      'primary/raised',
      theme.colors.text.primary,
      theme.colors.bg.raised,
      minimum
    )
    pair(
      'secondary/surface',
      theme.colors.text.secondary,
      theme.colors.bg.surface,
      minimum
    )
    pair(
      'muted/surface',
      theme.colors.text.muted,
      theme.colors.bg.surface,
      minimum
    )
  })
})

test('accent buttons keep body-text contrast', () => {
  eachTheme((theme) => {
    pair(
      'accent foreground',
      theme.colors.accent.foreground,
      theme.colors.accent.default,
      4.5
    )
    pair(
      'accent hover foreground',
      theme.colors.accent.foreground,
      theme.colors.accent.hover,
      4.5
    )
  })
})

test('focus rings and strong borders are distinguishable UI elements', () => {
  eachTheme((theme) => {
    pair(
      'focus ring/surface',
      theme.colors.border.focus,
      theme.colors.bg.surface,
      3
    )
    pair(
      'strong border/surface',
      theme.colors.border.strong,
      theme.colors.bg.surface,
      3
    )
  })
})

test('status colours are readable on their surfaces', () => {
  eachTheme((theme) => {
    pair(
      'success',
      theme.colors.status.success,
      theme.colors.status.successSurface,
      4.5
    )
    pair(
      'warning',
      theme.colors.status.warning,
      theme.colors.status.warningSurface,
      4.5
    )
    pair(
      'danger',
      theme.colors.status.danger,
      theme.colors.status.dangerSurface,
      4.5
    )
    pair('info', theme.colors.status.info, theme.colors.status.infoSurface, 4.5)
    pair(
      'neutral',
      theme.colors.status.neutral,
      theme.colors.status.neutralSurface,
      4.5
    )
    pair(
      'success/surface',
      theme.colors.status.success,
      theme.colors.bg.surface,
      3
    )
    pair(
      'warning/surface',
      theme.colors.status.warning,
      theme.colors.bg.surface,
      3
    )
    pair(
      'danger/surface',
      theme.colors.status.danger,
      theme.colors.bg.surface,
      3
    )
    pair('info/surface', theme.colors.status.info, theme.colors.bg.surface, 3)
  })
})

test('chart series are distinguishable against the chart surface', () => {
  eachTheme((theme) => {
    theme.colors.chart.forEach((colour, index) => {
      pair(`chart ${index + 1}`, colour, theme.colors.bg.surface, 3)
    })
  })
})

test('themes differ in shape, depth, density and motion', () => {
  assert.notEqual(themes.ivory.shape.card, themes.carbon.shape.card)
  assert.notEqual(themes.ivory.depth.card, themes.carbon.depth.card)
  assert.notEqual(themes.ivory.density.fontSize, themes.carbon.density.fontSize)
  assert.notEqual(
    themes.ivory.motion.durationBase,
    themes.carbon.motion.durationBase
  )
  assert.equal(themes.contrast.depth.focusRingWidth, '4px')
  assert.equal(themes.contrast.motion.durationBase, '0ms')
})
