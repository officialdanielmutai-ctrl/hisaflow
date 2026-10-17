// Shared Hisaflow types.
//
// This package is declaration-only (see tsconfig `emitDeclarationOnly`), so
// consumers must use `import type`. Runtime constants and validation live in
// the app that owns them and are covered by unit tests on both sides.

// Placeholder kept for backwards compatibility with earlier scaffolding.
export type HisaflowSharedType = {
  id: string;
  name: string;
};

// ── Workspace customisation contract ────────────────────────────────────────
// Canonical shape for a user's Home customisation. Stored server-side as JSON
// per (user, organization) and validated on both the client and the server.
// See hisaflow-workspace-customisation.md §5–§6.

/** Preset widget sizes. S/M/L are exposed by the KPI registry today; W/XL are
 *  reserved for wider future widgets. */
export type WidgetSize = 'S' | 'M' | 'L' | 'W' | 'XL';

/** Layouts are stored per breakpoint so a desktop arrangement never wrecks the
 *  phone view. */
export type WorkspaceBreakpoint = 'desktop' | 'tablet' | 'mobile';

/** A widget surface is always controlled; raw wallpaper never sits behind
 *  text. Glass is bounded by the contrast guard. */
export type WidgetSurface = 'solid' | 'glass' | 'tinted';

export type WorkspaceMode = 'light' | 'dark' | 'system';

/** Curated, pre-validated colour pair id (see the frontend palette). */
export type WorkspaceAccent = string;

export interface WidgetStyle {
  /** Curated palette id (never a free-form colour). */
  colour?: string;
  surface?: WidgetSurface;
  showTitle?: boolean;
  /** Sanitised, length-limited display title override. */
  title?: string;
  /** Icon name from the app's single icon set. */
  icon?: string;
}

/** One placed widget in one breakpoint. `order` drives the responsive flow;
 *  v1 deliberately avoids free-form x/y coordinates (see C-0 report §9.4). */
export interface WidgetInstance {
  instanceId: string;
  widgetId: string;
  size: WidgetSize;
  order: number;
  locked?: boolean;
  style?: WidgetStyle;
  /** Widget-specific display options, declared by the widget registry. */
  config?: Record<string, unknown>;
}

export interface WorkspaceBreakpoints {
  desktop: WidgetInstance[];
  tablet: WidgetInstance[];
  mobile: WidgetInstance[];
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  /** Set when the layout was created from a built-in template. */
  templateId?: string;
  breakpoints: WorkspaceBreakpoints;
}

export interface WorkspaceTheme {
  /** Curated accent id; per-widget colours override it. */
  accent?: WorkspaceAccent;
  mode?: WorkspaceMode;
  /** 0 = solid, 100 = maximum safe glass. Clamped by the contrast guard. */
  transparency?: number;
  blur?: boolean;
}

export type WorkspaceWallpaperType = 'preset' | 'upload';

export interface WorkspaceWallpaper {
  type: WorkspaceWallpaperType;
  id: string;
  /** Optional user-scoped asset reference once upload is enabled. */
  assetRef?: string;
}

export interface UserWorkspace {
  schemaVersion: number;
  activeLayoutId: string;
  layouts: WorkspaceLayout[];
  theme: WorkspaceTheme;
  wallpaper: WorkspaceWallpaper;
  /** ISO timestamp; the server is authoritative (last-write-wins). */
  updatedAt?: string;
}

/** The response shape for GET/PUT /workspace. A null workspace means the user
 *  has never saved one, so Home renders its built-in default. */
export interface WorkspaceResponse {
  workspace: UserWorkspace | null;
}
