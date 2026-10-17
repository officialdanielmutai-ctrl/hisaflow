import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrendingUp } from 'lucide-react';
import type { UserWorkspace } from '@hisaflow/types';
import type { StatCardConfig } from '@/components/system/StatCard';
import { defaultWorkspace } from '@/lib/workspace';

const { state } = vi.hoisted(() => ({
  state: { workspace: null as UserWorkspace | null },
}));

vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ workspace: state.workspace, enabled: true }),
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

describe('DashboardKpiRows customisation layer', () => {
  beforeEach(() => {
    state.workspace = null;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1440,
    });
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
    state.workspace = {
      ...defaultWorkspace(),
      activeLayoutId: 'personal',
      layouts: [
        {
          id: 'personal',
          name: 'Mine',
          breakpoints: {
            desktop: [
              { instanceId: 'b', widgetId: 'beta', size: 'M', order: 0 },
            ],
            tablet: [],
            mobile: [],
          },
        },
      ],
    };

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
});
