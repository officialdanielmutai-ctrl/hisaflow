import type {
  UserWorkspace,
  WidgetInstance,
  WidgetSize,
  WidgetStyle,
  WorkspaceBreakpoints,
  WorkspaceLayout,
  WorkspaceMode,
  WorkspaceTheme,
  WorkspaceWallpaper,
} from '../workspace.types';
import {
  ACCENT_IDS,
  BREAKPOINTS,
  MAX_COLOUR_ID,
  MAX_CONFIG_BYTES,
  MAX_CONFIG_DEPTH,
  MAX_ICON_NAME,
  MAX_INSTANCE_ID,
  MAX_LAYOUT_ID,
  MAX_LAYOUT_NAME,
  MAX_LAYOUTS_HARD_CAP,
  MAX_WALLPAPER_ID,
  MAX_WIDGET_ID,
  MAX_WIDGET_TITLE,
  MAX_WIDGETS_PER_BREAKPOINT,
  MAX_WORKSPACE_BYTES,
  WALLPAPER_IDS,
  WALLPAPER_TYPES,
  WIDGET_SIZES,
  WIDGET_SURFACES,
  WORKSPACE_MODES,
  WORKSPACE_SCHEMA_VERSION,
} from '../workspace.constants';

export type WorkspaceValidationResult =
  | { ok: true; value: UserWorkspace; warnings: string[] }
  | { ok: false; errors: string[] };

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Replaces ASCII control characters without a control-char regex. */
function stripControlChars(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 32 || code === 127 ? ' ' : char;
  }
  return out;
}

/** Trims, strips control characters, and length-limits a user string. */
function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = stripControlChars(value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

function cleanId(value: unknown, maxLength: number): string | undefined {
  return cleanString(value, maxLength);
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Recursively keeps JSON-safe primitives and drops dangerous keys. Used for
 * widget-specific config so a stored layout can never smuggle in prototype
 * pollution or unbounded data.
 */
function sanitiseJsonValue(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (depth >= MAX_CONFIG_DEPTH) return null;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitiseJsonValue(entry, depth + 1));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value).slice(0, 20)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      if (key.length > 64) continue;
      out[key] = sanitiseJsonValue(entry, depth + 1);
    }
    return out;
  }

  return null;
}

function sanitiseConfig(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) return undefined;
  const sanitised = sanitiseJsonValue(value, 0);
  if (!isPlainObject(sanitised)) return undefined;
  // Bound the serialised size as well as the shape.
  if (Buffer.byteLength(JSON.stringify(sanitised), 'utf8') > MAX_CONFIG_BYTES) {
    return undefined;
  }
  return sanitised;
}

function sanitiseStyle(value: unknown): WidgetStyle | undefined {
  if (!isPlainObject(value)) return undefined;

  const style: WidgetStyle = {};
  const colour = cleanString(value.colour, MAX_COLOUR_ID);
  if (colour) style.colour = colour;
  if (isOneOf(value.surface, WIDGET_SURFACES)) style.surface = value.surface;
  if (typeof value.showTitle === 'boolean') style.showTitle = value.showTitle;
  const title = cleanString(value.title, MAX_WIDGET_TITLE);
  if (title) style.title = title;
  const icon = cleanString(value.icon, MAX_ICON_NAME);
  if (icon) style.icon = icon;

  return Object.keys(style).length > 0 ? style : undefined;
}

function sanitiseInstance(
  raw: unknown,
  index: number,
): WidgetInstance | null {
  if (!isPlainObject(raw)) return null;

  const instanceId = cleanId(raw.instanceId, MAX_INSTANCE_ID);
  const widgetId = cleanId(raw.widgetId, MAX_WIDGET_ID);
  if (!instanceId || !widgetId) return null;

  const size: WidgetSize = isOneOf(raw.size, WIDGET_SIZES) ? raw.size : 'M';
  const order = Number.isInteger(raw.order) && (raw.order as number) >= 0
    ? (raw.order as number)
    : index;

  const instance: WidgetInstance = { instanceId, widgetId, size, order };
  if (raw.locked === true) instance.locked = true;

  const style = sanitiseStyle(raw.style);
  if (style) instance.style = style;

  const config = sanitiseConfig(raw.config);
  if (config) instance.config = config;

  return instance;
}

function sanitiseBreakpoint(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const instances: WidgetInstance[] = [];
  for (let i = 0; i < raw.length && instances.length < MAX_WIDGETS_PER_BREAKPOINT; i += 1) {
    const instance = sanitiseInstance(raw[i], i);
    if (!instance) continue;
    if (seen.has(instance.instanceId)) continue;
    seen.add(instance.instanceId);
    instances.push(instance);
  }

  return instances
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_WIDGETS_PER_BREAKPOINT)
    .map((instance, index) => ({ ...instance, order: index }));
}

function sanitiseBreakpoints(raw: unknown): WorkspaceBreakpoints {
  const source = isPlainObject(raw) ? raw : {};
  return {
    desktop: sanitiseBreakpoint(source.desktop),
    tablet: sanitiseBreakpoint(source.tablet),
    mobile: sanitiseBreakpoint(source.mobile),
  };
}

function sanitiseLayout(raw: unknown, index: number): WorkspaceLayout | null {
  if (!isPlainObject(raw)) return null;

  const id = cleanId(raw.id, MAX_LAYOUT_ID);
  if (!id) return null;

  const name = cleanString(raw.name, MAX_LAYOUT_NAME) ?? `Layout ${index + 1}`;
  const layout: WorkspaceLayout = {
    id,
    name,
    breakpoints: sanitiseBreakpoints(raw.breakpoints),
  };

  const templateId = cleanString(raw.templateId, MAX_LAYOUT_ID);
  if (templateId) layout.templateId = templateId;

  return layout;
}

function sanitiseTheme(raw: unknown): WorkspaceTheme {
  const source = isPlainObject(raw) ? raw : {};
  const accent = isOneOf(source.accent, ACCENT_IDS) ? source.accent : 'emerald';
  const mode: WorkspaceMode = isOneOf(source.mode, WORKSPACE_MODES)
    ? source.mode
    : 'system';

  const theme: WorkspaceTheme = {
    accent,
    mode,
    transparency: clampInt(source.transparency, 0, 100, 0),
    blur: source.blur !== false,
  };
  return theme;
}

function sanitiseWallpaper(raw: unknown): WorkspaceWallpaper {
  const source = isPlainObject(raw) ? raw : {};
  const type = isOneOf(source.type, WALLPAPER_TYPES) ? source.type : 'preset';
  const requested = cleanString(source.id, MAX_WALLPAPER_ID);
  const id = requested && (WALLPAPER_IDS as readonly string[]).includes(requested)
    ? requested
    : 'default';

  const wallpaper: WorkspaceWallpaper = { type, id };
  const assetRef = cleanString(source.assetRef, 200);
  if (assetRef) wallpaper.assetRef = assetRef;
  return wallpaper;
}

/** Byte size of the serialised payload, used for the 64 KB cap. */
export function workspacePayloadBytes(input: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(input), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Validates and sanitises an untrusted workspace document. Structural errors
 * (not an object, wrong top-level types, oversized payload) reject the request;
 * individual bad widgets/layouts are dropped so a partially corrupt saved
 * layout still recovers instead of blanking Home.
 */
export function validateWorkspace(input: unknown): WorkspaceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['Workspace must be a JSON object.'] };
  }

  if (workspacePayloadBytes(input) > MAX_WORKSPACE_BYTES) {
    return {
      ok: false,
      errors: [`Workspace payload exceeds ${MAX_WORKSPACE_BYTES} bytes.`],
    };
  }

  const schemaVersion = input.schemaVersion;
  if (
    !Number.isInteger(schemaVersion) ||
    (schemaVersion as number) < 1 ||
    (schemaVersion as number) > WORKSPACE_SCHEMA_VERSION
  ) {
    errors.push(
      `schemaVersion must be an integer between 1 and ${WORKSPACE_SCHEMA_VERSION}.`,
    );
  }

  if (!Array.isArray(input.layouts)) {
    errors.push('layouts must be an array.');
  } else if (input.layouts.length > MAX_LAYOUTS_HARD_CAP) {
    errors.push(`layouts cannot contain more than ${MAX_LAYOUTS_HARD_CAP} entries.`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const layouts: WorkspaceLayout[] = [];
  const seenLayoutIds = new Set<string>();
  for (const raw of input.layouts as unknown[]) {
    const layout = sanitiseLayout(raw, layouts.length);
    if (!layout || seenLayoutIds.has(layout.id)) {
      warnings.push('Dropped an invalid or duplicate layout.');
      continue;
    }
    seenLayoutIds.add(layout.id);
    layouts.push(layout);
  }

  if (layouts.length !== (input.layouts as unknown[]).length) {
    warnings.push('Some layouts could not be restored and were dropped.');
  }

  const requestedActive = cleanId(input.activeLayoutId, MAX_LAYOUT_ID);
  const activeLayoutId =
    requestedActive && seenLayoutIds.has(requestedActive)
      ? requestedActive
      : (layouts[0]?.id ?? 'default');

  if (requestedActive && requestedActive !== activeLayoutId) {
    warnings.push('The active layout was missing; fell back to the first layout.');
  }

  return {
    ok: true,
    value: {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      activeLayoutId,
      layouts,
      theme: sanitiseTheme(input.theme),
      wallpaper: sanitiseWallpaper(input.wallpaper),
    },
    warnings,
  };
}

/** Validates just the layout payload accepted by the layout CRUD endpoints. */
export function validateLayoutInput(
  input: unknown,
): { ok: true; value: WorkspaceLayout } | { ok: false; errors: string[] } {
  if (!isPlainObject(input)) {
    return { ok: false, errors: ['Layout must be an object.'] };
  }

  const id = cleanId(input.id, MAX_LAYOUT_ID);
  const name = cleanString(input.name, MAX_LAYOUT_NAME);
  if (!id) return { ok: false, errors: ['Layout id is required.'] };
  if (!name) return { ok: false, errors: ['Layout name is required.'] };

  const layout: WorkspaceLayout = {
    id,
    name,
    breakpoints: sanitiseBreakpoints(input.breakpoints),
  };
  const templateId = cleanString(input.templateId, MAX_LAYOUT_ID);
  if (templateId) layout.templateId = templateId;

  for (const breakpoint of BREAKPOINTS) {
    if (layout.breakpoints[breakpoint].length > MAX_WIDGETS_PER_BREAKPOINT) {
      return {
        ok: false,
        errors: [`${breakpoint} cannot contain more than ${MAX_WIDGETS_PER_BREAKPOINT} widgets.`],
      };
    }
  }

  return { ok: true, value: layout };
}
