import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrendingUp } from 'lucide-react';
import type { UserWorkspace } from '@hisaflow/types';
import type { StatCardConfig } from '@/components/system/StatCard';
import { defaultWorkspace } from '@/lib/workspace';

const { state } = vi.hoisted(() => ({
  state: {
    workspace: null as UserWorkspace | null,
    preview: null as UserWorkspace | null,
  },
}));

vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({
    enabled: true,
    workspace: state.workspace,
    preview: state.preview,
    setPreview: (next: UserWorkspace | null) => {
      state.preview = next;
    },
    save: async (next: UserWorkspace) => next,
    pendingSync: false,
    error: null,
  }),
}));

vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('@/components/workspace/WorkspaceSheet', () => ({
  WorkspaceSheet: () => null,
  default: () => null,
}));

import { DashboardKpiRows } from './DashboardKpiRows';

function config(id: string, label: string): StatCardConfig<{ value: string }> {
  return {
    id,
    label,
    icon: TrendingUp,
    build: () => ({ value: '1' }),
  };
}

const rows: StatCardConfig<{ value: string }>[][] = [
  [config('alpha', 'Alpha'), config('beta', 'Beta')],
];

function savedWithBeta(): UserWorkspace {
  return {
    ...defaultWorkspace(),
    activeLayoutId: 'personal',
    layouts: [
      {
        id: 'personal',
        name: 'Mine',
        breakpoints: {
          desktop: [{ instanceId: 'b', widgetId: 'beta', size: 'M', order: 0 }],
          tablet: [],
          mobile: [],
        },
      },
    ],
  };
}

function savedWithBoth(): UserWorkspace {
  return {
    ...defaultWorkspace(),
    activeLayoutId: 'personal',
    layouts: [
      {
        id: 'personal',
        name: 'Mine',
        breakpoints: {
          desktop: [
            { instanceId: 'a', widgetId: 'alpha', size: 'M', order: 0 },
            { instanceId: 'b', widgetId: 'beta', size: 'M', order: 1 },
          ],
          tablet: [],
          mobile: [],
        },
      },
    ],
  };
}

describe('DashboardKpiRows customisation layer', () => {
  beforeEach(() => {
    state.workspace = null;
    state.preview = null;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1440,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the original arrangement when no workspace is saved', () => {
    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    expect(screen.getAllByTestId('stat-card')).toHaveLength(2);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-kpi-grid')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Customise Home')).toBeInTheDocument();
  });

  it('renders only the saved widgets, in saved order, in the custom grid', () => {
    state.workspace = savedWithBeta();

    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    expect(screen.getByTestId('custom-kpi-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('stat-card')).toHaveLength(1);
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('falls back to the default arrangement when the saved breakpoint is empty', () => {
    state.workspace = {
      ...defaultWorkspace(),
      activeLayoutId: 'personal',
      layouts: [
        {
          id: 'personal',
          name: 'Mine',
          breakpoints: { desktop: [], tablet: [], mobile: [] },
        },
      ],
    };

    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    expect(screen.getAllByTestId('stat-card')).toHaveLength(2);
  });

  it('opens the per-widget menu from the ⋯ affordance', () => {
    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.click(screen.getByLabelText('Options for Alpha'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /style/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /remove/i })).toBeInTheDocument();
  });

  it('opens the per-widget menu on right-click', () => {
    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.contextMenu(screen.getByText('Alpha'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('opens the per-widget menu after a long press', () => {
    vi.useFakeTimers();
    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.pointerDown(screen.getAllByTestId('workspace-widget')[0], {
      button: 0,
      clientX: 20,
      clientY: 20,
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('does not open the menu when the long press turns into a scroll', () => {
    vi.useFakeTimers();
    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    const widget = screen.getAllByTestId('workspace-widget')[0];
    // jsdom has no PointerEvent; MouseEvent supplies the client coordinates
    // the long-press cancel threshold reads.
    fireEvent(
      widget,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    fireEvent(
      widget,
      new MouseEvent('pointermove', { bubbles: true, clientX: 20, clientY: 80 }),
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('previews theme and colour changes on the live Home grid', () => {
    state.preview = {
      ...savedWithBeta(),
      theme: { ...defaultWorkspace().theme, accent: 'blue' },
    };

    render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    const widget = screen.getByTestId('workspace-widget');
    expect(widget.style.getPropertyValue('--color-border')).toBe('#bfdbfe');
    expect(widget.style.borderColor).toMatch(/#bfdbfe|rgb\(191, 219, 254\)/);
  });

  it('reorders widgets with the keyboard pick-up alternative', () => {
    state.workspace = savedWithBoth();
    const { rerender } = render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.click(screen.getByLabelText('Customise Home'));
    rerender(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    const first = screen.getAllByTestId('workspace-widget')[0];
    fireEvent.keyDown(first, { key: 'Enter' });
    fireEvent.keyDown(first, { key: 'ArrowDown' });

    const labels = screen
      .getAllByTestId('stat-card')
      .map((element) => element.getAttribute('data-stat-label'));
    expect(labels).toEqual(['Beta', 'Alpha']);
  });

  it('reorders widgets by dragging one onto another', () => {
    state.workspace = savedWithBoth();
    const { rerender } = render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.click(screen.getByLabelText('Customise Home'));
    rerender(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    const [first, second] = screen.getAllByTestId('workspace-widget');
    fireEvent.dragStart(first, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragEnter(second);
    fireEvent.drop(second);

    const labels = screen
      .getAllByTestId('stat-card')
      .map((element) => element.getAttribute('data-stat-label'));
    expect(labels).toEqual(['Beta', 'Alpha']);
  });

  it('enters inline edit mode with add/move/resize controls and Done', () => {
    const { rerender } = render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.click(screen.getByLabelText('Customise Home'));
    expect(state.preview).not.toBeNull();

    rerender(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    expect(screen.getByText('Add widget')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByLabelText('Move Alpha down')).toBeInTheDocument();
    expect(screen.getByLabelText('Resize Alpha')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Alpha')).toBeInTheDocument();
  });

  it('moves a widget inline and reflects the new order immediately', () => {
    state.workspace = savedWithBoth();
    const { rerender } = render(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.click(screen.getByLabelText('Customise Home'));
    rerender(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    fireEvent.click(screen.getByLabelText('Move Alpha down'));
    rerender(<DashboardKpiRows rows={rows} data={{ value: '1' }} />);

    const labels = screen
      .getAllByTestId('stat-card')
      .map((element) => element.getAttribute('data-stat-label'));
    expect(labels).toEqual(['Beta', 'Alpha']);
  });
});
