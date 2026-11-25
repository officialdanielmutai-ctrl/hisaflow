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

// ── Data-integrity analytics contract (hisaflow-data-integrity-brief.md §4.2) ─
export type AnalyticsPreset =
  | 'today'
  | 'yesterday'
  | '12h'
  | '24h'
  | '7d'
  | 'week'
  | 'last_week'
  | '30d'
  | 'month'
  | 'last_month'
  | 'year'
  | 'custom';

export type AnalyticsGranularity = 'hour' | 'day' | 'month';

export interface SeriesBucket {
  /** Bucket start ISO timestamp in Africa/Nairobi (+03:00). */
  start: string;
  /** Human-readable short bucket label (e.g. "Mon", "14:00", "Nov 25"). */
  label: string;
  /** Exact server-computed bucket numeric value (0 when no records). */
  value: number;
  /** Number of underlying records contributing to this bucket. */
  count: number;
}

export type ComparisonStatus = 'ok' | 'no_previous_data' | 'not_applicable';

export interface PeriodComparison {
  previousTotal: number;
  /** Null when previousTotal === 0 or not applicable; never fabricated as +100%. */
  deltaPct: number | null;
  status: ComparisonStatus;
  periodLabel: string;
}

export interface ResolvedAnalyticsRange {
  preset: AnalyticsPreset;
  from: string;
  to: string;
  tz: 'Africa/Nairobi';
  granularity: AnalyticsGranularity;
  label: string;
  partialPeriod: boolean;
}

export interface DailyPerformancePoint {
  date: string;
  day: string;
  sales: number;
  expenses: number;
  salesCount: number;
  expensesCount: number;
}

export interface MetricSeriesSummary {
  total: number;
  buckets: SeriesBucket[];
  comparison: PeriodComparison;
}

export interface MetricDashboardResponse {
  metric: string;
  range: ResolvedAnalyticsRange;
  total: number;
  currency: string;
  buckets: SeriesBucket[];
  comparison: PeriodComparison;
  meta: {
    generatedAt: string;
    rowCount: number;
    partialPeriod: boolean;
    reconciled: boolean;
  };
}


/** The response shape for GET/PUT /workspace. A null workspace means the user
 *  has never saved one, so Home renders its built-in default. */
export interface WorkspaceResponse {
  workspace: UserWorkspace | null;
}
