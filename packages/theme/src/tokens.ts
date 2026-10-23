/**
 * Typed semantic token accessors. Application code calls `token('bg.surface')`
 * instead of writing CSS variable strings by hand. The generated stylesheet
 * defines every one of these variables for every theme.
 */

export const TOKEN_VARS = {
  'bg.canvas': '--hf-bg-canvas',
  'bg.surface': '--hf-bg-surface',
  'bg.raised': '--hf-bg-raised',
  'bg.elevated': '--hf-bg-elevated',
  'bg.secondary': '--hf-bg-secondary',
  'bg.hover': '--hf-bg-hover',
  'bg.overlay': '--hf-bg-overlay',

  'text.primary': '--hf-text-primary',
  'text.secondary': '--hf-text-secondary',
  'text.muted': '--hf-text-muted',
  'text.inverse': '--hf-text-inverse',

  'border.subtle': '--hf-border-subtle',
  'border.strong': '--hf-border-strong',
  'border.focus': '--hf-border-focus',

  'accent.default': '--hf-accent-default',
  'accent.hover': '--hf-accent-hover',
  'accent.foreground': '--hf-accent-foreground',
  'accent.subtle': '--hf-accent-subtle',

  'status.success': '--hf-status-success',
  'status.successSurface': '--hf-status-success-surface',
  'status.warning': '--hf-status-warning',
  'status.warningSurface': '--hf-status-warning-surface',
  'status.danger': '--hf-status-danger',
  'status.dangerSurface': '--hf-status-danger-surface',
  'status.info': '--hf-status-info',
  'status.infoSurface': '--hf-status-info-surface',
  'status.neutral': '--hf-status-neutral',
  'status.neutralSurface': '--hf-status-neutral-surface',

  'chart.1': '--hf-chart-1',
  'chart.2': '--hf-chart-2',
  'chart.3': '--hf-chart-3',
  'chart.4': '--hf-chart-4',
  'chart.5': '--hf-chart-5',
  'chart.6': '--hf-chart-6',
  'chart.7': '--hf-chart-7',
  'chart.8': '--hf-chart-8',

  scrim: '--hf-workspace-scrim',
  'selection.background': '--hf-selection-bg',
  'selection.foreground': '--hf-selection-fg',

  'radius.sm': '--hf-radius-sm',
  'radius.md': '--hf-radius-md',
  'radius.lg': '--hf-radius-lg',
  'radius.xl': '--hf-radius-xl',
  'radius.card': '--hf-radius-card',
  'radius.pill': '--hf-radius-pill',

  'shadow.card': '--hf-shadow-card',
  'shadow.raised': '--hf-shadow-raised',
  'shadow.overlay': '--hf-shadow-overlay',
  'border.width': '--hf-border-width',
  'focus.width': '--hf-focus-ring-width',
  'focus.offset': '--hf-focus-ring-offset',
  'focus.color': '--hf-border-focus',

  'density.fontSize': '--hf-font-size-base',
  'density.controlHeightSm': '--hf-control-height-sm',
  'density.controlHeightMd': '--hf-control-height-md',
  'density.controlHeightLg': '--hf-control-height-lg',
  'density.rowHeight': '--hf-row-height',
  'density.pageGap': '--hf-page-gap',
  'density.cardPadding': '--hf-card-padding',
  'density.touchTarget': '--hf-touch-target',

  'type.fontFamily': '--hf-font-family',
  'type.weightRegular': '--hf-font-weight-regular',
  'type.weightMedium': '--hf-font-weight-medium',
  'type.weightBold': '--hf-font-weight-bold',
  'type.trackingTight': '--hf-tracking-tight',

  'motion.durationFast': '--hf-motion-duration-fast',
  'motion.durationBase': '--hf-motion-duration-base',
  'motion.durationSlow': '--hf-motion-duration-slow',
  'motion.ease': '--hf-motion-ease',
  'motion.spring': '--hf-motion-spring',

  'icon.stroke': '--hf-icon-stroke',
} as const

export type TokenName = keyof typeof TOKEN_VARS

export function token(name: TokenName): string {
  return `var(${TOKEN_VARS[name]})`
}
