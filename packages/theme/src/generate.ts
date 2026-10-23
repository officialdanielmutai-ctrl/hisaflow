import { hexToHsl } from './color'
import { themes } from './themes'
import { THEME_IDS, type ThemeDefinition } from './types'

function declarationsForTheme(theme: ThemeDefinition): string[] {
  const c = theme.colors
  const s = theme.shape
  const d = theme.depth
  const density = theme.density
  const type = theme.typography
  const motion = theme.motion

  return [
    `color-scheme: ${theme.mode};`,
    `--hf-bg-canvas: ${c.bg.canvas};`,
    `--hf-bg-surface: ${c.bg.surface};`,
    `--hf-bg-raised: ${c.bg.raised};`,
    `--hf-bg-elevated: ${c.bg.elevated};`,
    `--hf-bg-secondary: ${c.bg.secondary};`,
    `--hf-bg-hover: ${c.bg.hover};`,
    `--hf-bg-overlay: ${c.bg.overlay};`,
    `--hf-text-primary: ${c.text.primary};`,
    `--hf-text-secondary: ${c.text.secondary};`,
    `--hf-text-muted: ${c.text.muted};`,
    `--hf-text-inverse: ${c.text.inverse};`,
    `--hf-border-subtle: ${c.border.subtle};`,
    `--hf-border-strong: ${c.border.strong};`,
    `--hf-border-focus: ${c.border.focus};`,
    `--hf-accent-default: ${c.accent.default};`,
    `--hf-accent-hover: ${c.accent.hover};`,
    `--hf-accent-foreground: ${c.accent.foreground};`,
    `--hf-accent-subtle: ${c.accent.subtle};`,
    `--hf-status-success: ${c.status.success};`,
    `--hf-status-success-surface: ${c.status.successSurface};`,
    `--hf-status-warning: ${c.status.warning};`,
    `--hf-status-warning-surface: ${c.status.warningSurface};`,
    `--hf-status-danger: ${c.status.danger};`,
    `--hf-status-danger-surface: ${c.status.dangerSurface};`,
    `--hf-status-info: ${c.status.info};`,
    `--hf-status-info-surface: ${c.status.infoSurface};`,
    `--hf-status-neutral: ${c.status.neutral};`,
    `--hf-status-neutral-surface: ${c.status.neutralSurface};`,
    ...c.chart.map((colour, index) => `--hf-chart-${index + 1}: ${colour};`),
    `--hf-workspace-scrim: ${c.scrim};`,
    `--hf-selection-bg: ${c.selection.background};`,
    `--hf-selection-fg: ${c.selection.foreground};`,
    `--hf-radius-sm: ${s.sm};`,
    `--hf-radius-md: ${s.md};`,
    `--hf-radius-lg: ${s.lg};`,
    `--hf-radius-xl: ${s.xl};`,
    `--hf-radius-card: ${s.card};`,
    `--hf-radius-pill: ${s.pill};`,
    `--hf-shadow-card: ${d.card};`,
    `--hf-shadow-raised: ${d.raised};`,
    `--hf-shadow-overlay: ${d.overlay};`,
    `--hf-border-width: ${d.borderWidth};`,
    `--hf-focus-ring-width: ${d.focusRingWidth};`,
    `--hf-focus-ring-offset: ${d.focusRingOffset};`,
    `--hf-font-size-base: ${density.fontSize};`,
    `--hf-control-height-sm: ${density.controlHeightSm};`,
    `--hf-control-height-md: ${density.controlHeightMd};`,
    `--hf-control-height-lg: ${density.controlHeightLg};`,
    `--hf-row-height: ${density.rowHeight};`,
    `--hf-page-gap: ${density.pageGap};`,
    `--hf-card-padding: ${density.cardPadding};`,
    `--hf-touch-target: ${density.touchTarget};`,
    `--hf-font-family: ${type.fontFamily};`,
    `--hf-font-weight-regular: ${type.weightRegular};`,
    `--hf-font-weight-medium: ${type.weightMedium};`,
    `--hf-font-weight-bold: ${type.weightBold};`,
    `--hf-tracking-tight: ${type.trackingTight};`,
    `--hf-motion-duration-fast: ${motion.durationFast};`,
    `--hf-motion-duration-base: ${motion.durationBase};`,
    `--hf-motion-duration-slow: ${motion.durationSlow};`,
    `--hf-motion-ease: ${motion.ease};`,
    `--hf-motion-spring: ${motion.spring};`,
    `--hf-icon-stroke: ${theme.iconStroke};`,

    // Bridge to the existing semantic variables. Components already consuming
    // these variables (and the Tailwind mappings below) re-skin automatically.
    `--color-bg-base: ${c.bg.canvas};`,
    `--color-bg-surface: ${c.bg.surface};`,
    `--color-bg-elevated: ${c.bg.elevated};`,
    `--color-bg-secondary: ${c.bg.secondary};`,
    `--color-bg-surface-hover: ${c.bg.hover};`,
    `--color-text-primary: ${c.text.primary};`,
    `--color-text-secondary: ${c.text.secondary};`,
    `--color-text-muted: ${c.text.muted};`,
    `--color-border: ${c.border.subtle};`,
    `--color-border-strong: ${c.border.strong};`,
    `--color-accent: ${c.accent.default};`,
    `--color-accent-hover: ${c.accent.hover};`,
    `--color-accent-foreground: ${c.accent.foreground};`,
    `--color-accent-blue: ${c.status.info};`,
    `--color-primary: ${c.accent.default};`,
    `--color-primary-hover: ${c.accent.hover};`,
    `--color-status-success: ${c.status.success};`,
    `--color-status-warning: ${c.status.warning};`,
    `--color-status-critical: ${c.status.danger};`,
    `--color-status-info: ${c.status.info};`,
    `--color-status-neutral: ${c.status.neutral};`,

    `--radius-sm: ${s.sm};`,
    `--radius-card: ${s.card};`,
    `--radius-lg: ${s.lg};`,
    `--radius-pill: ${s.pill};`,
    `--radius: ${s.md};`,
    `--shadow-card: ${d.card};`,
    `--shadow-raised: ${d.raised};`,
    `--shadow-overlay: ${d.overlay};`,

    // shadcn/ui consumes raw HSL channels.
    `--background: ${hexToHsl(c.bg.canvas)};`,
    `--foreground: ${hexToHsl(c.text.primary)};`,
    `--card: ${hexToHsl(c.bg.surface)};`,
    `--card-foreground: ${hexToHsl(c.text.primary)};`,
    `--popover: ${hexToHsl(c.bg.surface)};`,
    `--popover-foreground: ${hexToHsl(c.text.primary)};`,
    `--primary: ${hexToHsl(c.accent.default)};`,
    `--primary-foreground: ${hexToHsl(c.accent.foreground)};`,
    `--secondary: ${hexToHsl(c.bg.elevated)};`,
    `--secondary-foreground: ${hexToHsl(c.text.primary)};`,
    `--muted: ${hexToHsl(c.bg.elevated)};`,
    `--muted-foreground: ${hexToHsl(c.text.secondary)};`,
    `--accent: ${hexToHsl(c.accent.subtle)};`,
    `--accent-foreground: ${hexToHsl(c.text.primary)};`,
    `--destructive: ${hexToHsl(c.status.danger)};`,
    `--destructive-foreground: ${hexToHsl(c.text.inverse)};`,
    `--border: ${hexToHsl(c.border.subtle)};`,
    `--input: ${hexToHsl(c.border.subtle)};`,
    `--ring: ${hexToHsl(c.border.focus)};`,

    // Marketing surfaces share the same core semantic palette.
    `--mk-canvas: ${c.bg.canvas};`,
    `--mk-surface: ${c.bg.surface};`,
    `--mk-ink: ${c.text.primary};`,
    `--mk-ink-2: ${c.text.secondary};`,
    `--mk-ink-3: ${c.text.muted};`,
    `--mk-line: ${c.border.subtle};`,
    `--mk-accent: ${c.accent.default};`,
    `--mk-accent-hover: ${c.accent.hover};`,
    `--mk-accent-ink: ${c.accent.foreground};`,
  ]
}

function block(selector: string, theme: ThemeDefinition): string {
  return `${selector} {\n  ${declarationsForTheme(theme).join('\n  ')}\n}`
}

/**
 * Deterministic stylesheet generation. `theme-tokens.generated.css` is
 * committed and checked in CI so runtime never depends on a generator.
 */
export function generateThemeCss(): string {
  const blocks: string[] = [
    '/* eslint-disable */',
    '/* GENERATED FILE — edit packages/theme/src/themes.ts and run `pnpm --filter @hisaflow/theme generate`. */',
    ':root {',
    '  color-scheme: light;',
    '  --hf-font-size-base: 16px;',
    '}',
    'html {',
    '  font-size: var(--hf-font-size-base);',
    '}',
  ]

  for (const id of THEME_IDS) {
    blocks.push(block(`html[data-theme="${id}"]`, themes[id]))
  }

  blocks.push(
    '::selection {',
    '  background: var(--hf-selection-bg);',
    '  color: var(--hf-selection-fg);',
    '}',
    'html[data-theme] :where(a, button, input, select, textarea, [tabindex]):focus-visible {',
    '  outline: var(--hf-focus-ring-width) solid var(--hf-border-focus);',
    '  outline-offset: var(--hf-focus-ring-offset);',
    '}',
    'html[data-theme] svg.lucide {',
    '  stroke-width: var(--hf-icon-stroke);',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  html[data-theme] {',
    '    --hf-motion-duration-fast: 0ms;',
    '    --hf-motion-duration-base: 0ms;',
    '    --hf-motion-duration-slow: 0ms;',
    '    --hf-motion-ease: linear;',
    '    --hf-motion-spring: linear;',
    '  }',
    '}',
    '@media print {',
    `  html[data-theme] {\n    --hf-font-size-base: 16px;\n    ${declarationsForTheme(themes.ivory).join('\n    ')}\n  }`,
    '}',
    ''
  )

  return `${blocks.join('\n\n')}\n`
}
