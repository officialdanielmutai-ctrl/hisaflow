import {
  validateLayoutInput,
  validateWorkspace,
  workspacePayloadBytes,
} from './workspace-validation';
import {
  MAX_WIDGETS_PER_BREAKPOINT,
  MAX_WORKSPACE_BYTES,
  WORKSPACE_SCHEMA_VERSION,
} from '../workspace.constants';

function instance(overrides: Record<string, unknown> = {}) {
  return {
    instanceId: 'inst_1',
    widgetId: 'today-sales',
    size: 'M',
    order: 0,
    ...overrides,
  };
}

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeLayoutId: 'layout_1',
    layouts: [
      {
        id: 'layout_1',
        name: 'My layout',
        breakpoints: {
          desktop: [instance()],
          tablet: [],
          mobile: [],
        },
      },
    ],
    theme: { accent: 'blue', mode: 'dark', transparency: 20, blur: true },
    wallpaper: { type: 'preset', id: 'mist' },
    ...overrides,
  };
}

describe('validateWorkspace', () => {
  it('accepts a well-formed workspace and normalises defaults', () => {
    const result = validateWorkspace(workspace());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(result.value.activeLayoutId).toBe('layout_1');
    expect(result.value.layouts[0].breakpoints.desktop[0]).toMatchObject({
      widgetId: 'today-sales',
      size: 'M',
      order: 0,
    });
    expect(result.value.theme).toMatchObject({ accent: 'blue', mode: 'dark' });
    expect(result.value.wallpaper).toEqual({ type: 'preset', id: 'mist' });
  });

  it('rejects non-objects and oversized payloads', () => {
    expect(validateWorkspace(null).ok).toBe(false);
    expect(validateWorkspace('nope').ok).toBe(false);

    const huge = workspace({ activeLayoutId: 'x'.repeat(MAX_WORKSPACE_BYTES) });
    const result = validateWorkspace(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/exceeds/i);
  });

  it('rejects a bad schema version or non-array layouts', () => {
    expect(validateWorkspace(workspace({ schemaVersion: 0 })).ok).toBe(false);
    expect(validateWorkspace(workspace({ schemaVersion: 999 })).ok).toBe(false);
    expect(validateWorkspace(workspace({ layouts: 'nope' })).ok).toBe(false);
  });

  it('falls back to a valid active layout when the requested one is missing', () => {
    const result = validateWorkspace(workspace({ activeLayoutId: 'missing' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activeLayoutId).toBe('layout_1');
    expect(result.warnings.join(' ')).toMatch(/active layout/i);
  });

  it('drops unknown or invalid widget instances instead of failing', () => {
    const result = validateWorkspace(
      workspace({
        layouts: [
          {
            id: 'layout_1',
            name: 'My layout',
            breakpoints: {
              desktop: [
                instance({ instanceId: 'a', order: 0 }),
                { widgetId: 'no-instance-id' },
                instance({ instanceId: 'a', order: 1 }), // duplicate instance id
                'garbage',
              ],
              tablet: [],
              mobile: [],
            },
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.layouts[0].breakpoints.desktop).toHaveLength(1);
    expect(result.value.layouts[0].breakpoints.desktop[0].instanceId).toBe('a');
  });

  it('caps widgets per breakpoint and reindexes their order', () => {
    const many = Array.from({ length: MAX_WIDGETS_PER_BREAKPOINT + 5 }, (_, i) =>
      instance({ instanceId: `i_${i}`, order: 100 - i }),
    );

    const result = validateWorkspace(
      workspace({
        layouts: [
          {
            id: 'layout_1',
            name: 'Overflow',
            breakpoints: { desktop: many, tablet: [], mobile: [] },
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const desktop = result.value.layouts[0].breakpoints.desktop;
    expect(desktop).toHaveLength(MAX_WIDGETS_PER_BREAKPOINT);
    expect(desktop.map((w) => w.order)).toEqual(
      Array.from({ length: MAX_WIDGETS_PER_BREAKPOINT }, (_, i) => i),
    );
  });

  it('sanitises titles, surfacing and dangerous config keys', () => {
    const result = validateWorkspace(
      workspace({
        layouts: [
          {
            id: 'layout_1',
            name: '  My\u0000 layout  ',
            breakpoints: {
              desktop: [
                instance({
                  style: {
                    title: '  Sales\u0007 today  ',
                    surface: 'glass',
                    colour: 'violet',
                  },
                  config: {
                    period: 30,
                    nested: JSON.parse('{"ok":true,"__proto__":{"polluted":true}}'),
                  },
                }),
              ],
              tablet: [],
              mobile: [],
            },
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const layout = result.value.layouts[0];
    expect(layout.name).toBe('My layout');
    expect(layout.breakpoints.desktop[0].style).toMatchObject({
      title: 'Sales today',
      surface: 'glass',
      colour: 'violet',
    });
    expect(layout.breakpoints.desktop[0].config).toEqual({
      period: 30,
      nested: { ok: true },
    });
  });

  it('defaults invalid theme/wallpaper values to safe ones', () => {
    const result = validateWorkspace(
      workspace({
        theme: { accent: 'not-a-colour', mode: 'sepia', transparency: 900 },
        wallpaper: { type: 'video', id: 'nope' },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.theme).toMatchObject({
      accent: 'emerald',
      mode: 'system',
      transparency: 100,
    });
    expect(result.value.wallpaper).toEqual({ type: 'preset', id: 'default' });
  });

  it('rejects more than the hard layout cap', () => {
    const layouts = Array.from({ length: 21 }, (_, i) => ({
      id: `l_${i}`,
      name: `Layout ${i}`,
      breakpoints: { desktop: [], tablet: [], mobile: [] },
    }));

    expect(validateWorkspace(workspace({ layouts })).ok).toBe(false);
  });
});

describe('workspacePayloadBytes', () => {
  it('measures UTF-8 bytes and never throws on cyclic input', () => {
    expect(workspacePayloadBytes({ a: 'é' })).toBeGreaterThan(2);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(workspacePayloadBytes(cyclic)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('validateLayoutInput', () => {
  it('requires an id and a name and sanitises breakpoints', () => {
    expect(validateLayoutInput({ name: 'No id' }).ok).toBe(false);
    expect(validateLayoutInput({ id: 'l1' }).ok).toBe(false);

    const result = validateLayoutInput({
      id: 'l1',
      name: '  Operations  ',
      breakpoints: { desktop: [instance()], tablet: [], mobile: [] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Operations');
    expect(result.value.breakpoints.desktop).toHaveLength(1);
  });
});
