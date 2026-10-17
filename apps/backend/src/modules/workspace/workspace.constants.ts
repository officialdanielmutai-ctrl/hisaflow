/**
 * Workspace customisation limits and enums.
 *
 * The canonical data shape lives in `@hisaflow/types`; these are the runtime
 * limits shared by the server-side validator and (mirrored) the client helpers.
 * Keep this file dependency-free so it is cheap to import in tests.
 */

export const WORKSPACE_SCHEMA_VERSION = 1;

/** Protect Home and the payload: no arrangement can contain more than this. */
export const MAX_WIDGETS_PER_BREAKPOINT = 24;

/** Hard safety cap even for unlimited (Team/Growth) plans. */
export const MAX_LAYOUTS_HARD_CAP = 20;

/** Floor limit for non-Team plans (directive §7). */
export const PERSONAL_LAYOUT_LIMIT_FLOOR = 3;

/** Reject oversized payloads before they reach the validator/DB. */
export const MAX_WORKSPACE_BYTES = 64 * 1024;

export const MAX_INSTANCE_ID = 80;
export const MAX_WIDGET_ID = 80;
export const MAX_LAYOUT_ID = 80;
export const MAX_LAYOUT_NAME = 60;
export const MAX_WIDGET_TITLE = 60;
export const MAX_ICON_NAME = 40;
export const MAX_COLOUR_ID = 32;
export const MAX_WALLPAPER_ID = 64;
export const MAX_CONFIG_BYTES = 4 * 1024;
export const MAX_CONFIG_DEPTH = 3;

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
export const WIDGET_SIZES = ['S', 'M', 'L', 'W', 'XL'] as const;
export const WIDGET_SURFACES = ['solid', 'glass', 'tinted'] as const;
export const WORKSPACE_MODES = ['light', 'dark', 'system'] as const;
export const WALLPAPER_TYPES = ['preset', 'upload'] as const;

/** Curated accent ids. The frontend palette owns the actual colour values. */
export const ACCENT_IDS = [
  'emerald',
  'blue',
  'violet',
  'amber',
  'rose',
  'teal',
  'indigo',
  'slate',
] as const;

/** Placeholder wallpaper preset ids (frontend owns the artwork). */
export const WALLPAPER_IDS = [
  'default',
  'mist',
  'savanna',
  'sunset',
  'ocean',
  'forest',
  'slate',
] as const;
