/**
 * The theme contract. A theme is a complete, named experience: colour,
 * shape, depth, density, type and motion are all part of the same definition.
 *
 * Components must consume semantic tokens, never primitive values. CSS is
 * generated from these definitions into `theme-tokens.generated.css`.
 */

export const THEME_IDS = [
  'ivory',
  'carbon',
  'savanna',
  'midnight',
  'lagoon',
  'contrast',
] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeId | 'auto'

export interface ColorTokens {
  bg: {
    canvas: string
    surface: string
    raised: string
    elevated: string
    secondary: string
    hover: string
    overlay: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    inverse: string
  }
  border: {
    subtle: string
    strong: string
    focus: string
  }
  accent: {
    default: string
    hover: string
    foreground: string
    subtle: string
  }
  status: {
    success: string
    successSurface: string
    warning: string
    warningSurface: string
    danger: string
    dangerSurface: string
    info: string
    infoSurface: string
    neutral: string
    neutralSurface: string
  }
  chart: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ]
  scrim: string
  selection: {
    background: string
    foreground: string
  }
}

export interface ShapeTokens {
  sm: string
  md: string
  lg: string
  xl: string
  card: string
  pill: string
}

export interface DepthTokens {
  card: string
  raised: string
  overlay: string
  borderWidth: string
  focusRingWidth: string
  focusRingOffset: string
}

export interface DensityTokens {
  fontSize: string
  controlHeightSm: string
  controlHeightMd: string
  controlHeightLg: string
  rowHeight: string
  pageGap: string
  cardPadding: string
  touchTarget: string
}

export interface TypeTokens {
  fontFamily: string
  weightRegular: number
  weightMedium: number
  weightBold: number
  trackingTight: string
}

export interface MotionTokens {
  durationFast: string
  durationBase: string
  durationSlow: string
  ease: string
  spring: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  mode: ThemeMode
  colors: ColorTokens
  shape: ShapeTokens
  depth: DepthTokens
  density: DensityTokens
  typography: TypeTokens
  motion: MotionTokens
  iconStroke: number
}
