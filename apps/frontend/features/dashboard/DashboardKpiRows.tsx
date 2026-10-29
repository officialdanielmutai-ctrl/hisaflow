'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  MoreHorizontal,
  Palette,
  Plus,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { WorkspaceBreakpoint, WidgetInstance, WidgetSize } from '@hisaflow/types';
import { StatCard, type StatCardConfig } from '@/components/system/StatCard';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  accentById,
  buildWidgetRegistry,
  defaultInstances,
  defaultWorkspace,
  ensureReadable,
  moveInstance,
  removeInstance,
  reorderInstance,
  resolveBreakpoint,
  resolveInstances,
  setInstanceSize,
  withInstances,
} from '@/lib/workspace';
import {
  WorkspaceSheet,
  type WorkspaceTabId,
} from '@/components/workspace/WorkspaceSheet';
import { WidgetErrorBoundary } from '@/components/workspace/WidgetErrorBoundary';
import { cn } from '@/lib/utils';

const SIZE_ORDER: WidgetSize[] = ['S', 'M', 'L'];

/** Inline surface styles also carry text tokens so a tinted/glass card keeps
 *  its AA foreground even though StatCard renders its own token classes. */
type SurfaceStyle = CSSProperties & Record<`--${string}`, string>;

function useBreakpoint(): WorkspaceBreakpoint {
  const [breakpoint, setBreakpoint] = useState<WorkspaceBreakpoint>('desktop');

  useEffect(() => {
    const update = () => setBreakpoint(resolveBreakpoint(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return breakpoint;
}

function spanClass(instance: WidgetInstance, config: { span?: 1 | 2 }): string | undefined {
  if (instance.size === 'L') return 'sm:col-span-2 lg:col-span-2';
  if (instance.size === 'S') return undefined;
  return config.span === 2 ? 'sm:col-span-2 lg:col-span-2' : undefined;
}

function nextSize(size: WidgetSize): WidgetSize {
  const index = SIZE_ORDER.indexOf(size);
  return SIZE_ORDER[(index + 1) % SIZE_ORDER.length];
}

function cardSurface(
  instance: WidgetInstance,
  accentId: string | undefined,
  transparency: number | undefined,
  blur: boolean | undefined,
  dark: boolean,
  isHero?: boolean,
): SurfaceStyle {
  if (isHero) {
    return {
      backgroundColor: dark ? '#070D1E' : '#0C1831',
      borderColor: '#1e293b',
      color: '#ffffff',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#94a3b8',
      '--color-text-muted': '#64748b',
      '--color-border': '#1e293b',
    };
  }

  const accent = accentById(instance.style?.colour ?? accentId);
  const pair = dark ? accent.dark : accent.light;
  const surface = instance.style?.surface ?? 'solid';
  const foreground = ensureReadable(pair.text, pair.surface);

  if (surface === 'tinted') {
    return {
      backgroundColor: pair.surface,
      borderColor: pair.border,
      color: foreground,
      '--color-text-primary': foreground,
      '--color-text-secondary': foreground,
      '--color-text-muted': foreground,
      '--color-border': pair.border,
    };
  }

  if (surface === 'glass') {
    const alpha = Math.min(0.96, Math.max(0.86, 0.86 + (transparency ?? 0) / 100 * 0.1));
    const base = dark ? '#0f172a' : '#ffffff';
    const glassText = ensureReadable(dark ? '#f8fafc' : '#0b1120', base);
    return {
      backgroundColor: dark ? `rgba(15,23,42,${alpha})` : `rgba(255,255,255,${alpha})`,
      borderColor: pair.border,
      color: glassText,
      '--color-text-primary': glassText,
      '--color-text-secondary': glassText,
      '--color-text-muted': glassText,
      '--color-border': pair.border,
      backdropFilter: blur === false ? undefined : 'blur(14px)',
      WebkitBackdropFilter: blur === false ? undefined : 'blur(14px)',
    };
  }

  // A solid card stays opaque, but its accent border makes the global accent
  // (and a per-widget colour) visible without changing the card's readability.
  return {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: pair.border,
    '--color-border': pair.border,
  };
}

/**
 * Renders a vertical's KPI arrangement (overhaul Duty 1, Section 2.5) and its
 * Home customisation layer.
 *
 * No saved workspace and not editing → the original markup (grouped rows of
 * shared `StatCard`s). Otherwise → an ordered, sized, styled grid. Editing is
 * inline on Home: drag/move/add/resize/remove happen on the grid itself, with
 * a live draft (`preview`) so changes are visible immediately. Long-press /
 * right-click / ⋯ opens the per-widget menu.
 */
export function DashboardKpiRows<TData>({
  rows,
  data,
}: {
  rows: StatCardConfig<TData>[][];
  data: TData;
}) {
  const widgets = useMemo(() => buildWidgetRegistry(rows), [rows]);
  const widgetById = useMemo(
    () => new Map(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );
  const { workspace, preview, setPreview, save, enabled, pendingSync, error } =
    useWorkspace();
  const { theme } = useTheme();
  const breakpoint = useBreakpoint();

  const rendered = preview ?? workspace;
  const editing = preview !== null;
  const customised = rendered !== null;
  const instances = useMemo(
    () => resolveInstances(rendered, breakpoint, widgets),
    [rendered, breakpoint, widgets],
  );

  const [panel, setPanel] = useState<WorkspaceTabId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [history, setHistory] = useState<WidgetInstance[][]>([]);
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );

  const dark = theme === 'dark';

  const apply = (
    updater: (current: WidgetInstance[]) => WidgetInstance[],
    announcement: string,
  ) => {
    const base = preview ?? workspace ?? defaultWorkspace();
    const current = resolveInstances(base, breakpoint, widgets);
    setHistory((entries) => [...entries, current]);
    setPreview(withInstances(base, breakpoint, updater(current)));
    setNotice(announcement);
    setMenuFor(null);
    setPickedId(null);
    setDropIndex(null);
  };

  const beginEdit = () => {
    if (!preview) setPreview(workspace ?? defaultWorkspace());
    setNotice('');
  };

  const cancelEditing = () => {
    setPreview(null);
    setPanel(null);
    setSelectedId(null);
    setMenuFor(null);
    setDragIndex(null);
    setDropIndex(null);
    setPickedId(null);
    setHistory([]);
    setConfirmReset(false);
    setNotice('');
  };

  const undo = () => {
    if (history.length === 0) return;
    const base = preview ?? workspace ?? defaultWorkspace();
    setPreview(withInstances(base, breakpoint, history[history.length - 1]));
    setHistory(history.slice(0, -1));
    setNotice('Change undone.');
  };

  const done = async () => {
    if (!preview) return;
    try {
      await save(preview);
    } catch {
      // Stay in edit mode so the user can retry; the provider shows the error.
      return;
    }
    setPreview(null);
    setPanel(null);
    setSelectedId(null);
    setMenuFor(null);
    setDragIndex(null);
    setDropIndex(null);
    setPickedId(null);
    setHistory([]);
    setNotice('');
  };

  const openPanel = (tab: WorkspaceTabId, instanceId?: string) => {
    beginEdit();
    setSelectedId(instanceId ?? null);
    setPanel(tab);
  };

  const move = (index: number, direction: -1 | 1) => {
    const widget = widgetById.get(instances[index]?.widgetId ?? '');
    apply(
      (current) => moveInstance(current, index, direction),
      `${widget?.title ?? 'Widget'} moved ${direction === -1 ? 'up' : 'down'}.`,
    );
  };

  const remove = (instance: WidgetInstance) => {
    const widget = widgetById.get(instance.widgetId);
    apply(
      (current) => removeInstance(current, instance.instanceId),
      `${widget?.title ?? 'Widget'} removed. Undo restores it.`,
    );
  };

  const resize = (instance: WidgetInstance, size: WidgetSize) => {
    const widget = widgetById.get(instance.widgetId);
    apply(
      (current) => setInstanceSize(current, instance.instanceId, size),
      `${widget?.title ?? 'Widget'} resized to ${size}.`,
    );
  };

  const drop = (to: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setDropIndex(null);
    if (from === null || from === to) return;
    apply(
      (current) => reorderInstance(current, from, to),
      'Widget moved.',
    );
  };

  const startLongPress = (
    instanceId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    // Left button / touch only. `undefined` appears in some synthetic/test
    // pointer events, so treat it as primary rather than dropping the gesture.
    if (event.button !== undefined && event.button !== 0) return;
    cancelLongPress();
    suppressClick.current = false;
    longPressOrigin.current = { x: event.clientX, y: event.clientY };
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setMenuFor(instanceId);
    }, 550);
  };

  const moveLongPress = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = longPressOrigin.current;
    if (!origin) return;
    if (
      Math.abs(event.clientX - origin.x) > 10 ||
      Math.abs(event.clientY - origin.y) > 10
    ) {
      cancelLongPress();
    }
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressOrigin.current = null;
  };

  const handleWidgetKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    instance: WidgetInstance,
    index: number,
    widgetTitle: string,
  ) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      setMenuFor(instance.instanceId);
      return;
    }

    if (!editing) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const next = pickedId === instance.instanceId ? null : instance.instanceId;
      setPickedId(next);
      setNotice(
        next
          ? `${widgetTitle} picked up. Use arrow keys to move, Enter to drop, Escape to cancel.`
          : `${widgetTitle} dropped.`,
      );
      return;
    }

    if (pickedId !== instance.instanceId) return;

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, event.key === 'ArrowUp' ? -1 : 1);
      setPickedId(instance.instanceId);
      setNotice(`${widgetTitle} moved to position ${index + (event.key === 'ArrowUp' ? 0 : 2)}.`);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setPickedId(null);
      setNotice(`${widgetTitle} dropped.`);
    }
  };

  const handleClickCapture = (event: React.MouseEvent) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  };

  const renderMenu = (instance: WidgetInstance, index: number) => {
    const widget = widgetById.get(instance.widgetId);
    if (!widget) return null;
    return (
      <>
        <button
          type="button"
          aria-label="Close widget menu"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setMenuFor(null)}
        />
        <div
          role="menu"
          aria-label={`${widget.title} options`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setMenuFor(null);
            }
          }}
          className="absolute right-1 top-9 z-30 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-1 text-left shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              beginEdit();
              setMenuFor(null);
            }}
            className="block w-full px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-base)]"
          >
            Edit Home
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={index === 0}
            onClick={() => move(index, -1)}
            className="block w-full px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] disabled:opacity-40"
          >
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={index === instances.length - 1}
            onClick={() => move(index, 1)}
            className="block w-full px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] disabled:opacity-40"
          >
            Move down
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              resize(instance, nextSize(instance.size));
              setMenuFor(null);
            }}
            className="block w-full px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)]"
          >
            Resize to {nextSize(instance.size)}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              openPanel('appearance', instance.instanceId);
              setMenuFor(null);
            }}
            className="block w-full px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)]"
          >
            Style &amp; colour
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => remove(instance)}
            className="block w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            Remove
          </button>
        </div>
      </>
    );
  };

  const renderWidget = (
    instance: WidgetInstance,
    index: number,
    options: { span?: string; surface?: CSSProperties; transparent: boolean },
  ) => {
    const widget = widgetById.get(instance.widgetId);
    if (!widget) return null;
    const menuOpen = menuFor === instance.instanceId;
    const picked = pickedId === instance.instanceId;

    return (
      <div
        key={instance.instanceId}
        data-testid="workspace-widget"
        data-widget-id={instance.widgetId}
        data-instance-id={instance.instanceId}
        role="group"
        aria-label={`${widget.title} widget`}
        aria-grabbed={editing ? picked : undefined}
        tabIndex={editing ? 0 : undefined}
        onKeyDown={(event) =>
          handleWidgetKeyDown(event, instance, index, widget.title)
        }
        className={cn(
          'group relative rounded-2xl',
          options.span,
          options.surface && 'border',
          editing && 'outline outline-1 outline-dashed outline-[var(--color-accent)]/40',
          picked && 'ring-2 ring-[var(--color-accent)] ring-offset-2',
          dragIndex === index && 'opacity-60',
          dropIndex === index && dragIndex !== index && 'ring-2 ring-[var(--color-accent)]',
        )}
        style={options.surface}
        draggable={editing}
        onDragStart={
          editing
            ? (event) => {
                event.dataTransfer.effectAllowed = 'move';
                setDragIndex(index);
              }
            : undefined
        }
        onDragOver={editing ? (event) => event.preventDefault() : undefined}
        onDragEnter={editing ? () => setDropIndex(index) : undefined}
        onDrop={editing ? () => drop(index) : undefined}
        onDragEnd={
          editing
            ? () => {
                setDragIndex(null);
                setDropIndex(null);
              }
            : undefined
        }
        onPointerDown={
          !editing ? (event) => startLongPress(instance.instanceId, event) : undefined
        }
        onPointerMove={!editing ? moveLongPress : undefined}
        onPointerUp={!editing ? cancelLongPress : undefined}
        onPointerLeave={!editing ? cancelLongPress : undefined}
        onPointerCancel={!editing ? cancelLongPress : undefined}
        onContextMenu={
          !editing
            ? (event) => {
                event.preventDefault();
                setMenuFor(instance.instanceId);
              }
            : undefined
        }
        onClickCapture={!editing ? handleClickCapture : undefined}
      >
        {editing && (
          <div className="absolute -top-4 left-2 z-10 flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-1 py-0.5 shadow-sm">
            <span
              className="cursor-grab p-1.5 text-[var(--color-text-muted)]"
              aria-hidden="true"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              aria-label={`Move ${widget.title} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="rounded p-1.5 text-[var(--color-text-secondary)] disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Move ${widget.title} down`}
              disabled={index === instances.length - 1}
              onClick={() => move(index, 1)}
              className="rounded p-1.5 text-[var(--color-text-secondary)] disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Resize ${widget.title}`}
              onClick={() => resize(instance, nextSize(instance.size))}
              className="rounded px-1.5 py-1 text-[10px] font-bold text-[var(--color-text-secondary)]"
            >
              {instance.size}
            </button>
            <button
              type="button"
              aria-label={`Remove ${widget.title}`}
              onClick={() => remove(instance)}
              className="rounded p-1.5 text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!editing && (
          <button
            type="button"
            aria-label={`Options for ${widget.title}`}
            aria-haspopup="menu"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuFor(instance.instanceId);
            }}
            className="absolute right-1.5 top-1.5 z-10 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)]/90 p-1 text-[var(--color-text-muted)] shadow-sm transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}

        <WidgetErrorBoundary label={widget.title}>
          <StatCard
            label={widget.config.label}
            icon={widget.config.icon}
            iconTone={widget.config.iconTone}
            cardTone={widget.config.cardTone}
            variant={instance.size === 'S' ? 'compact' : widget.config.variant}
            href={editing ? undefined : widget.config.href}
            className={options.transparent && widget.config.cardTone !== 'hero' ? '!border-transparent !bg-transparent shadow-none' : undefined}
            {...widget.config.build(data)}
          />
        </WidgetErrorBoundary>

        {menuOpen && renderMenu(instance, index)}
      </div>
    );
  };

  return (
    <div className="relative">
      {enabled && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          {pendingSync && (
            <span className="mr-auto rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
              Saved on this device — sync pending
            </span>
          )}
          {error && (
            <span
              role="alert"
              className="mr-auto max-w-full rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
            >
              {error}
            </span>
          )}
          {!editing ? (
            <button
              type="button"
              onClick={beginEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              aria-label="Customise Home"
              data-walkthrough="customise-home"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Customise
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openPanel('widgets')}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
              <button
                type="button"
                onClick={() => openPanel('layout')}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Layout
              </button>
              <button
                type="button"
                onClick={() => openPanel('appearance')}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold"
              >
                <Palette className="h-3.5 w-3.5" /> Style
              </button>
              <button
                type="button"
                onClick={() => openPanel('wallpaper')}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Wallpaper
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-semibold"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={done}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-bold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Done
              </button>
            </>
          )}
        </div>
      )}

      {editing && confirmReset && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          <span className="min-w-0 flex-1">
            Restore the default arrangement? Widget styles are kept.
          </span>
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              apply((current) => {
                const styles = new Map(
                  current.map((instance) => [instance.widgetId, instance.style]),
                );
                return defaultInstances(widgets).map((instance) => ({
                  ...instance,
                  ...(styles.get(instance.widgetId)
                    ? { style: styles.get(instance.widgetId) }
                    : {}),
                }));
              }, 'Layout reset to the default arrangement. Styles kept. Undo restores it.');
              setConfirmReset(false);
            }}
            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white"
          >
            Reset
          </button>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {notice}
      </p>

      {!customised ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {rows.flat().map((card) => {
            const flatIndex = defaultInstances(widgets).findIndex(
              (instance) => instance.widgetId === card.id,
            );
            const instance: WidgetInstance = {
              instanceId: `default:${card.id}`,
              widgetId: card.id,
              size: card.span === 2 ? 'L' : 'M',
              order: flatIndex,
            };
            return renderWidget(instance, flatIndex, {
              span: card.span === 2 ? 'sm:col-span-2 lg:col-span-2' : undefined,
              transparent: false,
            });
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5" data-testid="custom-kpi-grid">
          {instances.map((instance, index) => {
            const widget = widgetById.get(instance.widgetId);
            if (!widget) return null;
            return renderWidget(instance, index, {
              span: spanClass(instance, widget.config),
              transparent: true,
              surface: cardSurface(
                instance,
                rendered?.theme.accent,
                rendered?.theme.transparency,
                rendered?.theme.blur,
                dark,
                widget.config.cardTone === 'hero',
              ),
            });
          })}
          {editing && (
            <button
              type="button"
              onClick={() => openPanel('widgets')}
              className="flex min-h-[120px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <Plus className="h-4 w-4" /> Add widget
            </button>
          )}
        </div>
      )}

      <WorkspaceSheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        widgets={widgets}
        breakpoint={breakpoint}
        initialTab={panel ?? 'widgets'}
        initialSelectedId={selectedId}
      />
    </div>
  );
}

export default DashboardKpiRows;
