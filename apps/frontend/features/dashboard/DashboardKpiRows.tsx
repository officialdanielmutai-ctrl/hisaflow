'use client';

import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { WorkspaceBreakpoint, WidgetInstance } from '@hisaflow/types';
import { StatCard, type StatCardConfig } from '@/components/system/StatCard';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  accentById,
  buildWidgetRegistry,
  ensureReadable,
  resolveBreakpoint,
  resolveInstances,
  wallpaperById,
} from '@/lib/workspace';
import { WorkspaceSheet } from '@/components/workspace/WorkspaceSheet';
import { WidgetErrorBoundary } from '@/components/workspace/WidgetErrorBoundary';
import { cn } from '@/lib/utils';

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
  if (instance.size === 'L') return 'sm:col-span-2';
  if (instance.size === 'S') return undefined;
  return config.span === 2 ? 'sm:col-span-2' : undefined;
}

function cardSurface(
  instance: WidgetInstance,
  accentId: string | undefined,
  transparency: number | undefined,
  blur: boolean | undefined,
  dark: boolean,
): React.CSSProperties {
  const accent = accentById(instance.style?.colour ?? accentId);
  const pair = dark ? accent.dark : accent.light;
  const surface = instance.style?.surface ?? 'solid';

  if (surface === 'tinted') {
    return {
      backgroundColor: pair.surface,
      borderColor: pair.border,
      color: ensureReadable(pair.text, pair.surface),
    };
  }

  if (surface === 'glass') {
    // Bounded glass: a high minimum opacity keeps the token text readable over
    // the worst wallpaper region. The contrast guard picks the text extreme.
    const alpha = Math.min(0.96, Math.max(0.86, 0.86 + (transparency ?? 0) / 100 * 0.1));
    const base = dark ? '#0f172a' : '#ffffff';
    return {
      backgroundColor: dark ? `rgba(15,23,42,${alpha})` : `rgba(255,255,255,${alpha})`,
      borderColor: pair.border,
      color: ensureReadable(dark ? '#f8fafc' : '#0b1120', base),
      backdropFilter: blur === false ? undefined : 'blur(14px)',
      WebkitBackdropFilter: blur === false ? undefined : 'blur(14px)',
    };
  }

  return {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border)',
  };
}

/**
 * Renders a vertical's KPI arrangement (overhaul Duty 1, Section 2.5) and its
 * optional customisation layer.
 *
 * With no saved workspace the markup is exactly what shipped before: each row
 * is a 2-column grid of shared `StatCard`s. A saved workspace switches to an
 * ordered, sized, styled grid built from the same `StatCardConfig`s, so what a
 * widget displays never changes — only its placement and presentation.
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
  const { workspace, enabled } = useWorkspace();
  const { theme } = useTheme();
  const breakpoint = useBreakpoint();
  const [sheetOpen, setSheetOpen] = useState(false);

  const customised = workspace !== null;
  const instances = useMemo(
    () => resolveInstances(workspace, breakpoint, widgets),
    [workspace, breakpoint, widgets],
  );

  const dark = theme === 'dark';
  const wallpaper = wallpaperById(workspace?.wallpaper.id);
  const wallpaperStyle =
    customised && workspace?.wallpaper.id !== 'default'
      ? {
          background: dark ? wallpaper.dark : wallpaper.light,
          padding: '12px',
          borderRadius: '24px',
        }
      : undefined;

  return (
    <div className="relative">
      {enabled && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            aria-label="Customise Home"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Customise
          </button>
        </div>
      )}

      {!customised ? (
        <div className="flex flex-col gap-4">
          {rows.map((row, rowIndex) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={rowIndex}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {row.map((card) => (
                <StatCard
                  key={card.id}
                  label={card.label}
                  icon={card.icon}
                  iconTone={card.iconTone}
                  cardTone={card.cardTone}
                  variant={card.variant}
                  href={card.href}
                  className={card.span === 2 ? 'sm:col-span-2' : undefined}
                  {...card.build(data)}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          style={wallpaperStyle}
          data-testid="custom-kpi-grid"
        >
          {instances.map((instance) => {
            const widget = widgetById.get(instance.widgetId);
            if (!widget) return null;
            return (
              <div
                key={instance.instanceId}
                className={cn('rounded-2xl border', spanClass(instance, widget.config))}
                style={cardSurface(
                  instance,
                  workspace?.theme.accent,
                  workspace?.theme.transparency,
                  workspace?.theme.blur,
                  dark,
                )}
              >
                <WidgetErrorBoundary label={widget.title}>
                  <StatCard
                    label={widget.config.label}
                    icon={widget.config.icon}
                    iconTone={widget.config.iconTone}
                    cardTone={widget.config.cardTone}
                    variant={instance.size === 'S' ? 'compact' : widget.config.variant}
                    href={widget.config.href}
                    className="!border-transparent !bg-transparent shadow-none"
                    {...widget.config.build(data)}
                  />
                </WidgetErrorBoundary>
              </div>
            );
          })}
        </div>
      )}

      <WorkspaceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        widgets={widgets}
        breakpoint={breakpoint}
      />
    </div>
  );
}

export default DashboardKpiRows;
