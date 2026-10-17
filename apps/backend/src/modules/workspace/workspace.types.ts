/**
 * Backend mirror of the workspace contract in `@hisaflow/types`.
 *
 * The shared package is declaration-only and lives outside the backend TS
 * program; ts-jest cannot compile a type-only import from outside `rootDir`
 * reliably. These interfaces mirror the canonical shared shape exactly. The
 * frontend consumes the shared package; keep the two in sync when the contract
 * changes (see the C-0 discovery report).
 */

export type WidgetSize = 'S' | 'M' | 'L' | 'W' | 'XL';
export type WorkspaceBreakpoint = 'desktop' | 'tablet' | 'mobile';
export type WidgetSurface = 'solid' | 'glass' | 'tinted';
export type WorkspaceMode = 'light' | 'dark' | 'system';
export type WorkspaceAccent = string;

export interface WidgetStyle {
  colour?: string;
  surface?: WidgetSurface;
  showTitle?: boolean;
  title?: string;
  icon?: string;
}

export interface WidgetInstance {
  instanceId: string;
  widgetId: string;
  size: WidgetSize;
  order: number;
  locked?: boolean;
  style?: WidgetStyle;
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
  templateId?: string;
  breakpoints: WorkspaceBreakpoints;
}

export interface WorkspaceTheme {
  accent?: WorkspaceAccent;
  mode?: WorkspaceMode;
  transparency?: number;
  blur?: boolean;
}

export type WorkspaceWallpaperType = 'preset' | 'upload';

export interface WorkspaceWallpaper {
  type: WorkspaceWallpaperType;
  id: string;
  assetRef?: string;
}

export interface UserWorkspace {
  schemaVersion: number;
  activeLayoutId: string;
  layouts: WorkspaceLayout[];
  theme: WorkspaceTheme;
  wallpaper: WorkspaceWallpaper;
  updatedAt?: string;
}
