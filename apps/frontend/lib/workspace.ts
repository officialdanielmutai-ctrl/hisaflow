import type {
  UserWorkspace,
  WidgetInstance,
  WidgetSize,
  WidgetStyle,
  WorkspaceBreakpoint,
  WorkspaceLayout,
  WorkspaceTheme,
  WorkspaceWallpaper,
} from '@hisaflow/types';
import type { StatCardConfig } from '@/components/system/StatCard';

// ── Contract constants (mirror the server-side validator) ───────────────────
export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_WIDGETS_PER_BREAKPOINT = 24;
export const BREAKPOINTS: WorkspaceBreakpoint[] = ['desktop', 'tablet', 'mobile'];

/** Sizes exposed by the KPI widget registry (W/XL reserved for wider widgets). */
export const KPI_WIDGET_SIZES: WidgetSize[] = ['S', 'M', 'L'];

export const DEFAULT_THEME: WorkspaceTheme = {
  accent: 'emerald',
  mode: 'system',
  transparency: 0,
  blur: true,
};

export const DEFAULT_WALLPAPER: WorkspaceWallpaper = {
  type: 'preset',
  id: 'default',
};

export function defaultWorkspace(): UserWorkspace {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeLayoutId: 'default',
    layouts: [],
    theme: { ...DEFAULT_THEME },
    wallpaper: { ...DEFAULT_WALLPAPER },
  };
}

// ── Curated accents (pre-validated AA text/surface pairs) ───────────────────
export interface AccentOption {
  id: string;
  label: string;
  value: string;
  light: { surface: string; text: string; border: string };
  dark: { surface: string; text: string; border: string };
}

export const ACCENTS: AccentOption[] = [
  {
    id: 'emerald',
    label: 'Emerald',
    value: '#059669',
    light: { surface: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
    dark: { surface: '#052e26', text: '#a7f3d0', border: '#065f46' },
  },
  {
    id: 'blue',
    label: 'Blue',
    value: '#2563eb',
    light: { surface: '#eff6ff', text: '#1e3a8a', border: '#bfdbfe' },
    dark: { surface: '#0b1b3a', text: '#bfdbfe', border: '#1e40af' },
  },
  {
    id: 'violet',
    label: 'Violet',
    value: '#7c3aed',
    light: { surface: '#f5f3ff', text: '#4c1d95', border: '#ddd6fe' },
    dark: { surface: '#1e1b4b', text: '#ddd6fe', border: '#5b21b6' },
  },
  {
    id: 'amber',
    label: 'Amber',
    value: '#d97706',
    light: { surface: '#fffbeb', text: '#78350f', border: '#fde68a' },
    dark: { surface: '#2a1a05', text: '#fde68a', border: '#92400e' },
  },
  {
    id: 'rose',
    label: 'Rose',
    value: '#e11d48',
    light: { surface: '#fff1f2', text: '#881337', border: '#fecdd3' },
    dark: { surface: '#2b0a12', text: '#fecdd3', border: '#9f1239' },
  },
  {
    id: 'teal',
    label: 'Teal',
    value: '#0d9488',
    light: { surface: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
    dark: { surface: '#042f2e', text: '#99f6e4', border: '#115e59' },
  },
  {
    id: 'indigo',
    label: 'Indigo',
    value: '#4f46e5',
    light: { surface: '#eef2ff', text: '#312e81', border: '#c7d2fe' },
    dark: { surface: '#1e1b4b', text: '#c7d2fe', border: '#3730a3' },
  },
  {
    id: 'slate',
    label: 'Slate',
    value: '#475569',
    light: { surface: '#f8fafc', text: '#1e293b', border: '#cbd5e1' },
    dark: { surface: '#0f172a', text: '#e2e8f0', border: '#334155' },
  },
];

export function accentById(id: string | undefined): AccentOption {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}

// ── Wallpaper presets (no upload in v1) ─────────────────────────────────────
export interface WallpaperPreset {
  id: string;
  label: string;
  light: string;
  dark: string;
  baseLight: string;
  baseDark: string;
}

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'default',
    label: 'None',
    light: 'transparent',
    dark: 'transparent',
    baseLight: '#f8fafc',
    baseDark: '#0b1120',
  },
  {
    id: 'mist',
    label: 'Mist',
    light: 'linear-gradient(135deg, #ecfeff 0%, #f0fdf4 55%, #f8fafc 100%)',
    dark: 'linear-gradient(135deg, #082f49 0%, #052e26 55%, #0b1120 100%)',
    baseLight: '#ecfeff',
    baseDark: '#082f49',
  },
  {
    id: 'savanna',
    label: 'Savanna',
    light: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 45%, #ffedd5 100%)',
    dark: 'linear-gradient(135deg, #2a1a05 0%, #3b2408 45%, #1c1205 100%)',
    baseLight: '#fefce8',
    baseDark: '#2a1a05',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    light: 'linear-gradient(135deg, #fff7ed 0%, #ffe4e6 50%, #fae8ff 100%)',
    dark: 'linear-gradient(135deg, #2b0a12 0%, #2e1065 55%, #1f0a2e 100%)',
    baseLight: '#fff7ed',
    baseDark: '#2b0a12',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    light: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 50%, #ecfeff 100%)',
    dark: 'linear-gradient(135deg, #0b1b3a 0%, #082f49 55%, #07121f 100%)',
    baseLight: '#eff6ff',
    baseDark: '#0b1b3a',
  },
  {
    id: 'forest',
    label: 'Forest',
    light: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #ecfdf5 100%)',
    dark: 'linear-gradient(135deg, #052e16 0%, #052e26 55%, #07140d 100%)',
    baseLight: '#f0fdf4',
    baseDark: '#052e16',
  },
  {
    id: 'slate',
    label: 'Slate',
    light: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    dark: 'linear-gradient(135deg, #0f172a 0%, #111827 55%, #020617 100%)',
    baseLight: '#f8fafc',
    baseDark: '#0f172a',
  },
];

export function wallpaperById(id: string | undefined): WallpaperPreset {
  return WALLPAPERS.find((preset) => preset.id === id) ?? WALLPAPERS[0];
}

// ── Built-in templates (config, not code) ───────────────────────────────────
export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Every available widget in its usual order.',
  },
  {
    id: 'essentials',
    name: 'Essentials',
    description: 'A few larger widgets for a calmer Home.',
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Things that need attention first.',
  },
  {
    id: 'numbers',
    name: 'Numbers',
    description: 'Sales, profit and totals first.',
  },
];

const OPERATIONS_HINTS = /(low|alert|attention|out|stock|task|issue|due|overdue)/i;
const NUMBERS_HINTS = /(sale|profit|expense|revenue|total|trend|health|count|today|month)/i;

// ── Widget registry (wraps the existing KPI configs) ────────────────────────
export interface DashboardWidget<TData = unknown> {
  id: string;
  title: string;
  description: string;
  category: 'kpi';
  supportedSizes: WidgetSize[];
  defaultSize: WidgetSize;
  multiInstance: boolean;
  config: StatCardConfig<TData>;
}

/**
 * Turns a vertical's existing `StatCardConfig[][]` into registry entries. The
 * config (and therefore what the card displays) is reused untouched; the
 * registry only adds customisation metadata.
 */
export function buildWidgetRegistry<TData>(
  rows: StatCardConfig<TData>[][],
): DashboardWidget<TData>[] {
  const seen = new Set<string>();
  const widgets: DashboardWidget<TData>[] = [];

  for (const config of rows.flat()) {
    if (seen.has(config.id)) continue;
    seen.add(config.id);
    widgets.push({
      id: config.id,
      title: config.label,
      description: `${config.label} metric`,
      category: 'kpi',
      supportedSizes: [...KPI_WIDGET_SIZES],
      defaultSize: config.span === 2 ? 'L' : 'M',
      multiInstance: false,
      config,
    });
  }

  return widgets;
}

// ── Layout helpers ─────────────────────────────────────────────────────────
export function defaultInstances<TData>(
  widgets: DashboardWidget<TData>[],
): WidgetInstance[] {
  return widgets.slice(0, MAX_WIDGETS_PER_BREAKPOINT).map((widget, index) => ({
    instanceId: `default:${widget.id}`,
    widgetId: widget.id,
    size: widget.defaultSize,
    order: index,
  }));
}

export function templateInstances<TData>(
  templateId: string,
  widgets: DashboardWidget<TData>[],
): WidgetInstance[] {
  if (templateId === 'essentials') {
    return widgets.slice(0, 4).map((widget, index) => ({
      instanceId: `essentials:${widget.id}`,
      widgetId: widget.id,
      size: 'L' as WidgetSize,
      order: index,
    }));
  }

  const hint =
    templateId === 'operations'
      ? OPERATIONS_HINTS
      : templateId === 'numbers'
        ? NUMBERS_HINTS
        : null;

  if (!hint) return defaultInstances(widgets);

  const ranked = [...widgets].sort((a, b) => {
    const aMatch = hint.test(a.id) || hint.test(a.title) ? 0 : 1;
    const bMatch = hint.test(b.id) || hint.test(b.title) ? 0 : 1;
    return aMatch - bMatch;
  });

  return ranked.map((widget, index) => ({
    instanceId: `${templateId}:${widget.id}`,
    widgetId: widget.id,
    size: widget.defaultSize,
    order: index,
  }));
}

export function activeLayout(
  workspace: UserWorkspace | null,
): WorkspaceLayout | null {
  if (!workspace) return null;
  return (
    workspace.layouts.find((layout) => layout.id === workspace.activeLayoutId) ??
    workspace.layouts[0] ??
    null
  );
}

/**
 * Instances to render for a breakpoint. No saved layout (or an empty/corrupt
 * breakpoint) falls back to the vertical's default arrangement, so Home can
 * never be blanked by customisation.
 */
export function resolveInstances<TData>(
  workspace: UserWorkspace | null,
  breakpoint: WorkspaceBreakpoint,
  widgets: DashboardWidget<TData>[],
): WidgetInstance[] {
  const defaults = defaultInstances(widgets);
  if (!workspace) return defaults;

  const layout = activeLayout(workspace);
  if (!layout) return defaults;

  const saved = layout.breakpoints[breakpoint];
  if (!Array.isArray(saved) || saved.length === 0) return defaults;

  const known = new Set(widgets.map((widget) => widget.id));
  const seen = new Set<string>();
  const resolved: WidgetInstance[] = [];

  for (const instance of saved) {
    if (!known.has(instance.widgetId)) continue;
    if (seen.has(instance.instanceId)) continue;
    seen.add(instance.instanceId);
    resolved.push(instance);
    if (resolved.length >= MAX_WIDGETS_PER_BREAKPOINT) break;
  }

  if (resolved.length === 0) return defaults;

  return resolved
    .sort((a, b) => a.order - b.order)
    .map((instance, index) => ({ ...instance, order: index }));
}

/** Replaces the active layout's instances for one breakpoint, keeping others. */
export function withInstances(
  workspace: UserWorkspace,
  breakpoint: WorkspaceBreakpoint,
  instances: WidgetInstance[],
): UserWorkspace {
  const reindexed = instances
    .slice(0, MAX_WIDGETS_PER_BREAKPOINT)
    .map((instance, index) => ({ ...instance, order: index }));

  const layout = activeLayout(workspace);
  const layoutId = layout?.id ?? 'default';
  const nextLayout: WorkspaceLayout = {
    id: layoutId,
    name: layout?.name ?? 'Default',
    ...(layout?.templateId ? { templateId: layout.templateId } : {}),
    breakpoints: {
      desktop: layout?.breakpoints.desktop ?? [],
      tablet: layout?.breakpoints.tablet ?? [],
      mobile: layout?.breakpoints.mobile ?? [],
      [breakpoint]: reindexed,
    },
  };

  const layouts = layout
    ? workspace.layouts.map((entry) => (entry.id === layout.id ? nextLayout : entry))
    : [nextLayout];

  return {
    ...workspace,
    activeLayoutId: layoutId,
    layouts,
  };
}

// ── Immutable instance operations ──────────────────────────────────────────
export function moveInstance(
  instances: WidgetInstance[],
  index: number,
  direction: -1 | 1,
): WidgetInstance[] {
  const target = index + direction;
  if (index < 0 || index >= instances.length || target < 0 || target >= instances.length) {
    return instances;
  }
  const next = [...instances];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((instance, order) => ({ ...instance, order }));
}

export function removeInstance(
  instances: WidgetInstance[],
  instanceId: string,
): WidgetInstance[] {
  return instances
    .filter((instance) => instance.instanceId !== instanceId)
    .map((instance, order) => ({ ...instance, order }));
}

export function addInstance(
  instances: WidgetInstance[],
  widgetId: string,
  size: WidgetSize = 'M',
): WidgetInstance[] {
  if (instances.length >= MAX_WIDGETS_PER_BREAKPOINT) return instances;
  const instance: WidgetInstance = {
    instanceId: `custom:${widgetId}:${Date.now().toString(36)}`,
    widgetId,
    size,
    order: instances.length,
  };
  return [...instances, instance];
}

export function setInstanceSize(
  instances: WidgetInstance[],
  instanceId: string,
  size: WidgetSize,
): WidgetInstance[] {
  return instances.map((instance) =>
    instance.instanceId === instanceId ? { ...instance, size } : instance,
  );
}

export function updateInstanceStyle(
  instances: WidgetInstance[],
  instanceId: string,
  patch: Partial<WidgetStyle>,
): WidgetInstance[] {
  return instances.map((instance) => {
    if (instance.instanceId !== instanceId) return instance;
    const style = { ...instance.style, ...patch };
    return { ...instance, style };
  });
}

/** The smallest supported size for a widget, used when a size is unsupported. */
export function nearestSupportedSize<TData>(
  widget: DashboardWidget<TData> | undefined,
  requested: WidgetSize,
): WidgetSize {
  if (!widget) return requested;
  if (widget.supportedSizes.includes(requested)) return requested;
  return widget.supportedSizes.includes('M') ? 'M' : widget.supportedSizes[0];
}

// ── Breakpoint detection ────────────────────────────────────────────────────
export function resolveBreakpoint(width: number): WorkspaceBreakpoint {
  if (width < 768) return 'mobile';
  if (width < 1200) return 'tablet';
  return 'desktop';
}

// ── Contrast guard ──────────────────────────────────────────────────────────
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  const expanded =
    raw.length === 3
      ? raw.split('').map((char) => char + char).join('')
      : raw;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Guarantees a foreground/background pair meets the AA floor. If the pair is
 * already readable it is returned unchanged; otherwise the text is swapped to
 * the readable extreme (near-black or near-white).
 */
export function ensureReadable(
  foreground: string,
  background: string,
  minimum = 4.5,
): string {
  if (contrastRatio(foreground, background) >= minimum) return foreground;
  return contrastRatio('#0b1120', background) >= contrastRatio('#ffffff', background)
    ? '#0b1120'
    : '#ffffff';
}

// ── Cache parsing (server remains authoritative) ────────────────────────────
export function isWorkspaceShape(value: unknown): value is UserWorkspace {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<UserWorkspace>;
  return (
    typeof candidate.schemaVersion === 'number' &&
    typeof candidate.activeLayoutId === 'string' &&
    Array.isArray(candidate.layouts) &&
    Boolean(candidate.theme) &&
    Boolean(candidate.wallpaper)
  );
}

export function parseCachedWorkspace(raw: string | null): UserWorkspace | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isWorkspaceShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
