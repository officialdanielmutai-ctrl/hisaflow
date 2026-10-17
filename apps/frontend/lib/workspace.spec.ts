import { describe, expect, it } from 'vitest';
import { TrendingUp } from 'lucide-react';
import type { StatCardConfig } from '@/components/system/StatCard';
import type { UserWorkspace, WidgetInstance } from '@hisaflow/types';
import {
  ACCENTS,
  MAX_WIDGETS_PER_BREAKPOINT,
  WALLPAPERS,
  accentById,
  addInstance,
  buildWidgetRegistry,
  contrastRatio,
  defaultInstances,
  defaultWorkspace,
  ensureReadable,
  moveInstance,
  nearestSupportedSize,
  parseCachedWorkspace,
  relativeLuminance,
  removeInstance,
  resolveBreakpoint,
  resolveInstances,
  setInstanceSize,
  templateInstances,
  updateInstanceStyle,
  wallpaperById,
  withInstances,
} from './workspace';

function config(id: string, label: string, span?: 1 | 2): StatCardConfig<{ value: string }> {
  return {
    id,
    label,
    icon: TrendingUp,
    span,
    build: () => ({ value: '1' }),
  };
}

const rows: StatCardConfig<{ value: string }>[][] = [
  [config('today-sales', "Today's Sales"), config('low-stock', 'Low Stock', 2)],
  [config('profit', 'Profit'), config('expenses', 'Expenses')],
];

function instance(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    instanceId: 'inst_1',
    widgetId: 'today-sales',
    size: 'M',
    order: 0,
    ...overrides,
  };
}

function savedWorkspace(overrides: Partial<UserWorkspace> = {}): UserWorkspace {
  return {
    ...defaultWorkspace(),
    activeLayoutId: 'layout_1',
    layouts: [
      {
        id: 'layout_1',
        name: 'Mine',
        breakpoints: {
          desktop: [
            instance({ instanceId: 'a', widgetId: 'profit', order: 1 }),
            instance({ instanceId: 'b', widgetId: 'today-sales', order: 0 }),
          ],
          tablet: [],
          mobile: [],
        },
      },
    ],
    ...overrides,
  };
}

describe('widget registry', () => {
  it('wraps the existing KPI configs without changing them', () => {
    const widgets = buildWidgetRegistry(rows);

    expect(widgets.map((w) => w.id)).toEqual([
      'today-sales',
      'low-stock',
      'profit',
      'expenses',
    ]);
    expect(widgets[1].config).toBe(rows[0][1]);
    expect(widgets[0].supportedSizes).toEqual(['S', 'M', 'L']);
    expect(widgets[1].defaultSize).toBe('L');
    expect(widgets[0].defaultSize).toBe('M');
  });

  it('deduplicates repeated widget ids', () => {
    const widgets = buildWidgetRegistry([[...rows[0], ...rows[0]]]);
    expect(widgets).toHaveLength(2);
  });
});

describe('layout resolution', () => {
  it('builds a default arrangement (all widgets, original order)', () => {
    const widgets = buildWidgetRegistry(rows);
    const defaults = defaultInstances(widgets);

    expect(defaults.map((i) => i.widgetId)).toEqual([
      'today-sales',
      'low-stock',
      'profit',
      'expenses',
    ]);
    expect(defaults.map((i) => i.order)).toEqual([0, 1, 2, 3]);
  });

  it('returns the default when there is no saved workspace', () => {
    const widgets = buildWidgetRegistry(rows);
    expect(resolveInstances(null, 'desktop', widgets)).toEqual(defaultInstances(widgets));
  });

  it('resolves a saved breakpoint sorted by order and drops unknown widgets', () => {
    const widgets = buildWidgetRegistry(rows);
    const workspace = savedWorkspace({
      layouts: [
        {
          id: 'layout_1',
          name: 'Mine',
          breakpoints: {
            desktop: [
              instance({ instanceId: 'a', widgetId: 'profit', order: 2 }),
              instance({ instanceId: 'x', widgetId: 'deleted-widget', order: 0 }),
              instance({ instanceId: 'b', widgetId: 'today-sales', order: 1 }),
            ],
            tablet: [],
            mobile: [],
          },
        },
      ],
    });

    expect(resolveInstances(workspace, 'desktop', widgets).map((i) => i.widgetId)).toEqual([
      'today-sales',
      'profit',
    ]);
  });

  it('falls back to the default for an empty breakpoint (never a blank Home)', () => {
    const widgets = buildWidgetRegistry(rows);
    const workspace = savedWorkspace();

    expect(resolveInstances(workspace, 'mobile', widgets)).toEqual(
      defaultInstances(widgets),
    );
  });

  it('writes one breakpoint while preserving the others', () => {
    const workspace = savedWorkspace();
    const next = withInstances(workspace, 'mobile', [
      instance({ instanceId: 'm1', widgetId: 'profit' }),
    ]);

    const layout = next.layouts[0];
    expect(layout.breakpoints.mobile.map((i) => i.widgetId)).toEqual(['profit']);
    expect(layout.breakpoints.desktop).toHaveLength(2);
    expect(layout.breakpoints.mobile[0].order).toBe(0);
  });

  it('creates a personal layout on first save', () => {
    const next = withInstances(defaultWorkspace(), 'desktop', [
      instance({ instanceId: 'a', widgetId: 'profit' }),
    ]);

    expect(next.layouts).toHaveLength(1);
    expect(next.activeLayoutId).toBe('default');
    expect(next.layouts[0].breakpoints.desktop).toHaveLength(1);
  });
});

describe('instance operations', () => {
  const base = [
    instance({ instanceId: 'a', order: 0 }),
    instance({ instanceId: 'b', order: 1 }),
    instance({ instanceId: 'c', order: 2 }),
  ];

  it('moves an instance and reindexes order', () => {
    const moved = moveInstance(base, 0, 1);
    expect(moved.map((i) => i.instanceId)).toEqual(['b', 'a', 'c']);
    expect(moved.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('ignores moves past either edge', () => {
    expect(moveInstance(base, 0, -1)).toBe(base);
    expect(moveInstance(base, 2, 1)).toBe(base);
  });

  it('removes an instance and reindexes', () => {
    const next = removeInstance(base, 'b');
    expect(next.map((i) => i.instanceId)).toEqual(['a', 'c']);
    expect(next.map((i) => i.order)).toEqual([0, 1]);
  });

  it('adds an instance and respects the per-breakpoint cap', () => {
    const next = addInstance(base, 'profit', 'L');
    expect(next).toHaveLength(4);
    expect(next[3]).toMatchObject({ widgetId: 'profit', size: 'L', order: 3 });

    const full = Array.from({ length: MAX_WIDGETS_PER_BREAKPOINT }, (_, i) =>
      instance({ instanceId: `i_${i}`, order: i }),
    );
    expect(addInstance(full, 'profit')).toBe(full);
  });

  it('updates size and style immutably', () => {
    const resized = setInstanceSize(base, 'b', 'L');
    expect(resized[1].size).toBe('L');
    expect(base[1].size).toBe('M');

    const styled = updateInstanceStyle(base, 'b', { surface: 'glass', colour: 'blue' });
    expect(styled[1].style).toEqual({ surface: 'glass', colour: 'blue' });
  });

  it('falls back to the nearest supported size', () => {
    const widgets = buildWidgetRegistry(rows);
    expect(nearestSupportedSize(widgets[0], 'XL')).toBe('M');
    expect(nearestSupportedSize(widgets[0], 'S')).toBe('S');
    expect(nearestSupportedSize(undefined, 'XL')).toBe('XL');
  });
});

describe('templates', () => {
  it('essentials keeps the first four widgets at size L', () => {
    const widgets = buildWidgetRegistry(rows);
    const applied = templateInstances('essentials', widgets);
    expect(applied).toHaveLength(4);
    expect(applied.every((i) => i.size === 'L')).toBe(true);
  });

  it('numbers puts sales/profit-like widgets first', () => {
    const widgets = buildWidgetRegistry(rows);
    const applied = templateInstances('numbers', widgets);
    expect(applied[0].widgetId).toMatch(/sale|profit/);
  });

  it('operations puts attention-like widgets first', () => {
    const widgets = buildWidgetRegistry(rows);
    const applied = templateInstances('operations', widgets);
    expect(applied[0].widgetId).toBe('low-stock');
  });

  it('default matches the built-in arrangement', () => {
    const widgets = buildWidgetRegistry(rows);
    expect(templateInstances('default', widgets)).toEqual(defaultInstances(widgets));
  });
});

describe('breakpoints and lookups', () => {
  it('maps widths to device classes', () => {
    expect(resolveBreakpoint(390)).toBe('mobile');
    expect(resolveBreakpoint(900)).toBe('tablet');
    expect(resolveBreakpoint(1440)).toBe('desktop');
  });

  it('falls back to the first accent/wallpaper for unknown ids', () => {
    expect(accentById('nope').id).toBe(ACCENTS[0].id);
    expect(wallpaperById('nope').id).toBe(WALLPAPERS[0].id);
  });
});

describe('contrast guard', () => {
  it('computes the standard black/white ratio', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });

  it('every curated accent pair meets AA in both modes', () => {
    for (const accent of ACCENTS) {
      expect(contrastRatio(accent.light.text, accent.light.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accent.dark.text, accent.dark.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('corrects an unreadable foreground to the readable extreme', () => {
    const corrected = ensureReadable('#eeeeee', '#ffffff');
    expect(corrected).toBe('#0b1120');
    expect(contrastRatio(corrected, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(ensureReadable('#0b1120', '#ffffff')).toBe('#0b1120');
  });
});

describe('cache parsing', () => {
  it('accepts a workspace-shaped object and rejects junk', () => {
    const workspace = defaultWorkspace();
    expect(parseCachedWorkspace(JSON.stringify(workspace))).toEqual(workspace);
    expect(parseCachedWorkspace('not json')).toBeNull();
    expect(parseCachedWorkspace(JSON.stringify({ nope: true }))).toBeNull();
    expect(parseCachedWorkspace(null)).toBeNull();
  });
});
