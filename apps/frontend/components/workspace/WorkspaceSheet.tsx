'use client';

import { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'vaul';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { UserWorkspace, WidgetInstance, WidgetSize, WorkspaceBreakpoint } from '@hisaflow/types';
import {
  ACCENTS,
  WALLPAPERS,
  WORKSPACE_TEMPLATES,
  accentById,
  addInstance,
  defaultInstances,
  defaultWorkspace,
  moveInstance,
  removeInstance,
  resolveInstances,
  setInstanceSize,
  templateInstances,
  updateInstanceStyle,
  wallpaperById,
  withInstances,
  type DashboardWidget,
} from '@/lib/workspace';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

type TabId = 'widgets' | 'layout' | 'appearance' | 'wallpaper';

interface WorkspaceSheetProps<TData> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: DashboardWidget<TData>[];
  breakpoint: WorkspaceBreakpoint;
}

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'widgets', label: 'Widgets', icon: LayoutGrid },
  { id: 'layout', label: 'Layout', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Style', icon: Palette },
  { id: 'wallpaper', label: 'Wallpaper', icon: ImageIcon },
];

function uid(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Home customisation editor. All edits are local to this session; nothing is
 * persisted until Done. Cancel discards, Undo walks the in-memory history, and
 * Reset is always available. Built on the same vaul sheet the rest of the app
 * uses, so it is a bottom sheet on mobile and a tall sheet on desktop.
 */
export function WorkspaceSheet<TData>({
  open,
  onOpenChange,
  widgets,
  breakpoint,
}: WorkspaceSheetProps<TData>) {
  const { workspace, save } = useWorkspace();

  const [draft, setDraft] = useState<UserWorkspace>(() => defaultWorkspace());
  const [instances, setInstances] = useState<WidgetInstance[]>([]);
  const [history, setHistory] = useState<WidgetInstance[][]>([]);
  const [tab, setTab] = useState<TabId>('widgets');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState<'layout' | 'all' | null>(null);
  const [saveName, setSaveName] = useState('');
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = workspace ?? defaultWorkspace();
    setDraft(base);
    setInstances(resolveInstances(base, breakpoint, widgets));
    setHistory([]);
    setTab('widgets');
    setMessage('');
    setError(null);
    setSaving(false);
    setConfirmReset(null);
    setSaveName('');
    setEditingLayoutId(null);
    setSelectedId(null);
  }, [open, workspace, breakpoint, widgets]);

  const visibleIds = useMemo(
    () => new Set(instances.map((instance) => instance.widgetId)),
    [instances],
  );
  const available = useMemo(
    () => widgets.filter((widget) => !visibleIds.has(widget.id)),
    [widgets, visibleIds],
  );
  const widgetById = useMemo(
    () => new Map(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );
  const selected = instances.find((instance) => instance.instanceId === selectedId);
  const wallpaper = wallpaperById(draft.wallpaper.id);

  const apply = (
    updater: (current: WidgetInstance[]) => WidgetInstance[],
    announcement: string,
  ) => {
    setHistory((entries) => [...entries, instances]);
    setInstances(updater(instances));
    setMessage(announcement);
    setError(null);
  };

  const undo = () => {
    if (history.length === 0) return;
    setInstances(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setMessage('Change undone.');
  };

  const handleAdd = (widget: DashboardWidget<TData>) => {
    apply(
      (current) => addInstance(current, widget.id, widget.defaultSize),
      `${widget.title} added.`,
    );
  };

  const handleRemove = (instance: WidgetInstance) => {
    const widget = widgetById.get(instance.widgetId);
    apply(
      (current) => removeInstance(current, instance.instanceId),
      `${widget?.title ?? 'Widget'} removed. Undo restores it.`,
    );
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const widget = widgetById.get(instances[index]?.widgetId ?? '');
    apply(
      (current) => moveInstance(current, index, direction),
      `${widget?.title ?? 'Widget'} moved ${direction === -1 ? 'up' : 'down'}.`,
    );
  };

  const handleSize = (instance: WidgetInstance, size: WidgetSize) => {
    const widget = widgetById.get(instance.widgetId);
    apply(
      (current) => setInstanceSize(current, instance.instanceId, size),
      `${widget?.title ?? 'Widget'} resized to ${size}.`,
    );
  };

  const handleStyle = (patch: { colour?: string; surface?: 'solid' | 'glass' | 'tinted' }) => {
    if (!selected) return;
    apply(
      (current) => updateInstanceStyle(current, selected.instanceId, patch),
      'Widget style updated.',
    );
  };

  const handleTemplate = (templateId: string) => {
    const template = WORKSPACE_TEMPLATES.find((entry) => entry.id === templateId);
    apply(
      () => templateInstances(templateId, widgets),
      `${template?.name ?? 'Template'} template applied.`,
    );
  };

  const handleUseLayout = (layoutId: string) => {
    const committed = withInstances(draft, breakpoint, instances);
    const next: UserWorkspace = { ...committed, activeLayoutId: layoutId };
    setDraft(next);
    setInstances(resolveInstances(next, breakpoint, widgets));
    setHistory([]);
    setMessage('Layout switched.');
    setError(null);
  };

  const handleSaveAs = () => {
    const name = saveName.trim();
    if (!name) return;
    const layout = {
      id: uid('personal'),
      name: name.slice(0, 60),
      breakpoints: {
        desktop: [] as WidgetInstance[],
        tablet: [] as WidgetInstance[],
        mobile: [] as WidgetInstance[],
        [breakpoint]: instances,
      },
    };
    setDraft({
      ...draft,
      activeLayoutId: layout.id,
      layouts: [...draft.layouts, layout],
    });
    setSaveName('');
    setMessage(`Saved “${name}” as a personal layout.`);
  };

  const handleDeleteLayout = (layoutId: string) => {
    const layouts = draft.layouts.filter((layout) => layout.id !== layoutId);
    const activeLayoutId =
      draft.activeLayoutId === layoutId
        ? (layouts[0]?.id ?? 'default')
        : draft.activeLayoutId;
    const next: UserWorkspace = { ...draft, layouts, activeLayoutId };
    setDraft(next);
    setInstances(resolveInstances(next, breakpoint, widgets));
    setHistory([]);
    setMessage('Layout deleted.');
  };

  const handleDuplicateLayout = (layoutId: string) => {
    const existing = draft.layouts.find((layout) => layout.id === layoutId);
    if (!existing) return;
    const copy = {
      ...existing,
      id: uid('personal'),
      name: `${existing.name.slice(0, 55)} copy`,
    };
    const next: UserWorkspace = {
      ...draft,
      activeLayoutId: copy.id,
      layouts: [...draft.layouts, copy],
    };
    setDraft(next);
    setInstances(resolveInstances(next, breakpoint, widgets));
    setHistory([]);
    setMessage('Layout duplicated.');
  };

  const handleRenameLayout = (layoutId: string) => {
    const name = editingName.trim();
    if (!name) return;
    setDraft({
      ...draft,
      layouts: draft.layouts.map((layout) =>
        layout.id === layoutId ? { ...layout, name: name.slice(0, 60) } : layout,
      ),
    });
    setEditingLayoutId(null);
    setEditingName('');
    setMessage('Layout renamed.');
  };

  const handleResetLayout = () => {
    const styles = new Map(instances.map((instance) => [instance.widgetId, instance.style]));
    const defaults = defaultInstances(widgets).map((instance) => ({
      ...instance,
      ...(styles.get(instance.widgetId) ? { style: styles.get(instance.widgetId) } : {}),
    }));
    apply(() => defaults, 'Layout reset to the default arrangement. Styles kept.');
    setConfirmReset(null);
  };

  const handleResetAll = () => {
    const reset = defaultWorkspace();
    setDraft({ ...reset, layouts: draft.layouts });
    setInstances(defaultInstances(widgets));
    setHistory([]);
    setConfirmReset(null);
    setMessage('Everything reset to defaults. Saved layouts were kept.');
  };

  const handleDone = async () => {
    setSaving(true);
    setError(null);
    try {
      await save(withInstances(draft, breakpoint, instances));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your workspace.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex h-[92vh] flex-col rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] outline-none">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div>
              <Drawer.Title className="text-base font-bold text-[var(--color-text-primary)]">
                Customise Home
              </Drawer.Title>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Saved when you tap Done. Cancel discards this session.
              </p>
            </div>
            <Drawer.Close
              aria-label="Close customisation"
              className="rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)]"
            >
              <X className="h-5 w-5" />
            </Drawer.Close>
          </div>

          {/* Live preview with sample data (never customer data). */}
          <div
            className="mx-4 mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] p-3"
            style={wallpaperLayers(wallpaper.light, wallpaper.baseLight)}
            aria-label="Preview"
          >
            <div className="flex gap-2">
              {instances.slice(0, 3).map((instance) => {
                const widget = widgetById.get(instance.widgetId);
                if (!widget) return null;
                return (
                  <div
                    key={instance.instanceId}
                    className="min-w-0 flex-1 rounded-xl border px-2 py-1.5"
                    style={previewStyle(instance, draft)}
                  >
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide opacity-80">
                      {widget.title}
                    </p>
                    <p className="truncate text-sm font-black">•••</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="mt-3 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-4"
            role="tablist"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold',
                  tab === id
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-secondary)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {tab === 'widgets' && (
              <div className="flex flex-col gap-2">
                {instances.map((instance, index) => {
                  const widget = widgetById.get(instance.widgetId);
                  if (!widget) return null;
                  return (
                    <div
                      key={instance.instanceId}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {widget.title}
                        </span>
                        <button
                          type="button"
                          aria-label={`Move ${widget.title} up`}
                          disabled={index === 0}
                          onClick={() => handleMove(index, -1)}
                          className="rounded-md p-1.5 text-[var(--color-text-secondary)] disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${widget.title} down`}
                          disabled={index === instances.length - 1}
                          onClick={() => handleMove(index, 1)}
                          className="rounded-md p-1.5 text-[var(--color-text-secondary)] disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${widget.title}`}
                          onClick={() => handleRemove(instance)}
                          className="rounded-md p-1.5 text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                          Size
                        </span>
                        {(['S', 'M', 'L'] as WidgetSize[]).map((size) => (
                          <button
                            key={size}
                            type="button"
                            aria-pressed={instance.size === size}
                            onClick={() => handleSize(instance, size)}
                            className={cn(
                              'h-7 w-7 rounded-md border text-xs font-bold',
                              instance.size === size
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                                : 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
                            )}
                          >
                            {size}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(instance.instanceId);
                            setTab('appearance');
                          }}
                          className="ml-auto rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]"
                        >
                          Style
                        </button>
                      </div>
                    </div>
                  );
                })}

                {available.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                      Add a widget
                    </p>
                    <div className="flex flex-col gap-2">
                      {available.map((widget) => (
                        <button
                          key={widget.id}
                          type="button"
                          onClick={() => handleAdd(widget)}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-left text-sm"
                        >
                          <Plus className="h-4 w-4 text-[var(--color-accent)]" />
                          <span className="min-w-0 flex-1 truncate font-medium">{widget.title}</span>
                          <span className="text-[11px] text-[var(--color-text-secondary)]">
                            {widget.defaultSize}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'layout' && (
              <div className="flex flex-col gap-5">
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Built-in templates
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {WORKSPACE_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplate(template.id)}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 text-left"
                      >
                        <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                          {template.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-text-secondary)]">
                          {template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    My layouts
                  </p>
                  <div className="flex flex-col gap-2">
                    {draft.layouts.length === 0 && (
                      <p className="rounded-xl border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-text-secondary)]">
                        You are using the default arrangement. Save it below to keep a personal copy.
                      </p>
                    )}
                    {draft.layouts.map((layout) => {
                      const active = draft.activeLayoutId === layout.id;
                      return (
                        <div
                          key={layout.id}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUseLayout(layout.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                {active && <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
                                {layout.name}
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Rename ${layout.name}`}
                              onClick={() => {
                                setEditingLayoutId(layout.id);
                                setEditingName(layout.name);
                              }}
                              className="rounded-md p-1.5 text-[var(--color-text-secondary)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Duplicate ${layout.name}`}
                              onClick={() => handleDuplicateLayout(layout.id)}
                              className="rounded-md p-1.5 text-[var(--color-text-secondary)]"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${layout.name}`}
                              onClick={() => handleDeleteLayout(layout.id)}
                              className="rounded-md p-1.5 text-rose-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {editingLayoutId === layout.id && (
                            <div className="mt-2 flex gap-2">
                              <input
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                aria-label="Layout name"
                                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameLayout(layout.id)}
                                className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white"
                              >
                                Save
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={saveName}
                      onChange={(event) => setSaveName(event.target.value)}
                      placeholder="Name this layout"
                      aria-label="New layout name"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAs}
                      disabled={!saveName.trim()}
                      className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Save as
                    </button>
                  </div>
                </section>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="flex flex-col gap-5">
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Accent
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-label={option.label}
                        aria-pressed={draft.theme.accent === option.id}
                        onClick={() => {
                          setDraft({ ...draft, theme: { ...draft.theme, accent: option.id } });
                          setMessage(`${option.label} accent selected.`);
                        }}
                        className={cn(
                          'h-9 w-9 rounded-full border-2',
                          draft.theme.accent === option.id
                            ? 'border-[var(--color-text-primary)]'
                            : 'border-transparent',
                        )}
                        style={{ backgroundColor: option.value }}
                      />
                    ))}
                  </div>
                </section>

                <section>
                  <label
                    htmlFor="workspace-transparency"
                    className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]"
                  >
                    <span>Transparency</span>
                    <span>{draft.theme.transparency ?? 0}%</span>
                  </label>
                  <input
                    id="workspace-transparency"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={draft.theme.transparency ?? 0}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        theme: { ...draft.theme, transparency: Number(event.target.value) },
                      })
                    }
                    className="w-full"
                  />
                  <button
                    type="button"
                    aria-pressed={draft.theme.blur !== false}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        theme: { ...draft.theme, blur: draft.theme.blur === false },
                      })
                    }
                    className="mt-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                  >
                    Blur {draft.theme.blur === false ? 'off' : 'on'}
                  </button>
                </section>

                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Per-widget style
                  </p>
                  <select
                    value={selectedId ?? ''}
                    onChange={(event) => setSelectedId(event.target.value || null)}
                    aria-label="Widget to style"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm"
                  >
                    <option value="">Choose a widget…</option>
                    {instances.map((instance) => {
                      const widget = widgetById.get(instance.widgetId);
                      return (
                        <option key={instance.instanceId} value={instance.instanceId}>
                          {widget?.title ?? instance.widgetId}
                        </option>
                      );
                    })}
                  </select>

                  {selected && (
                    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                          Colour
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            aria-pressed={!selected.style?.colour}
                            onClick={() => handleStyle({ colour: undefined })}
                            className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-semibold"
                          >
                            Auto
                          </button>
                          {ACCENTS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              aria-label={option.label}
                              aria-pressed={selected.style?.colour === option.id}
                              onClick={() => handleStyle({ colour: option.id })}
                              className={cn(
                                'h-7 w-7 rounded-full border-2',
                                selected.style?.colour === option.id
                                  ? 'border-[var(--color-text-primary)]'
                                  : 'border-transparent',
                              )}
                              style={{ backgroundColor: option.value }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                          Surface
                        </p>
                        <div className="flex gap-2">
                          {(['solid', 'glass', 'tinted'] as const).map((surface) => (
                            <button
                              key={surface}
                              type="button"
                              aria-pressed={(selected.style?.surface ?? 'solid') === surface}
                              onClick={() => handleStyle({ surface })}
                              className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize',
                                (selected.style?.surface ?? 'solid') === surface
                                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
                              )}
                            >
                              {surface}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {tab === 'wallpaper' && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Wallpaper presets
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {WALLPAPERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={draft.wallpaper.id === preset.id}
                      onClick={() => {
                        setDraft({
                          ...draft,
                          wallpaper: { type: 'preset', id: preset.id },
                        });
                        setMessage(`${preset.label} wallpaper selected.`);
                      }}
                      className={cn(
                        'overflow-hidden rounded-xl border-2 text-left',
                        draft.wallpaper.id === preset.id
                          ? 'border-[var(--color-accent)]'
                          : 'border-[var(--color-border)]',
                      )}
                    >
                      <div
                        className="h-16 w-full"
                        style={{
                          background:
                            preset.id === 'default'
                              ? 'repeating-linear-gradient(45deg, #e5e7eb 0 6px, #f8fafc 6px 12px)'
                              : preset.light,
                        }}
                      />
                      <span className="block px-2 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                  Widget surfaces stay readable over every preset. Uploads are not enabled yet.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}
            <p aria-live="polite" className="sr-only">
              {message}
            </p>
          </div>

          <div className="border-t border-[var(--color-border)] px-4 py-3">
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  {confirmReset === 'all'
                    ? 'Reset layout, styles and wallpaper? Saved layouts are kept.'
                    : 'Restore the default arrangement? Widget styles are kept.'}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmReset(null)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmReset === 'all' ? handleResetAll : handleResetLayout}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Reset
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.length === 0}
                  className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset('layout')}
                  className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset('all')}
                  className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Reset all
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="ml-auto rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  disabled={saving}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Done'}
                </button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function wallpaperLayers(background: string, fallback: string): React.CSSProperties {
  return background === 'transparent'
    ? { backgroundColor: fallback }
    : { background };
}

function previewStyle(
  instance: WidgetInstance,
  draft: UserWorkspace,
): React.CSSProperties {
  const chosen = accentById(instance.style?.colour ?? draft.theme.accent);
  const pair = draft.theme.mode === 'dark' ? chosen.dark : chosen.light;
  return {
    backgroundColor: pair.surface,
    color: pair.text,
    borderColor: pair.border,
  };
}

export default WorkspaceSheet;
