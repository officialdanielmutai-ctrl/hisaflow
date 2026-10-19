import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserWorkspace } from '@hisaflow/types';
import { defaultWorkspace } from '@/lib/workspace';

const { state } = vi.hoisted(() => ({
  state: {
    pathname: '/dashboard',
    workspace: null as UserWorkspace | null,
    preview: null as UserWorkspace | null,
    theme: 'light' as 'light' | 'dark',
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ workspace: state.workspace, preview: state.preview }),
}));

vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: state.theme }),
}));

import { WorkspaceBackdrop } from './WorkspaceBackdrop';

function withWallpaper(id = 'mist'): UserWorkspace {
  return { ...defaultWorkspace(), wallpaper: { type: 'preset', id } };
}

describe('WorkspaceBackdrop', () => {
  beforeEach(() => {
    state.pathname = '/dashboard';
    state.preview = null;
    state.theme = 'light';
    state.workspace = withWallpaper();
  });

  it('applies the chosen wallpaper to the whole Home area', () => {
    render(
      <WorkspaceBackdrop>
        <div>home</div>
      </WorkspaceBackdrop>,
    );

    const surface = screen.getByTestId('workspace-wallpaper');
    expect(surface.getAttribute('style')).toContain('linear-gradient');
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('does not apply a wallpaper on other dashboard screens', () => {
    state.pathname = '/inventory';

    render(
      <WorkspaceBackdrop>
        <div>other</div>
      </WorkspaceBackdrop>,
    );

    expect(screen.queryByTestId('workspace-wallpaper')).not.toBeInTheDocument();
  });

  it('does not render a surface for the default wallpaper', () => {
    state.workspace = defaultWorkspace();

    render(
      <WorkspaceBackdrop>
        <div>home</div>
      </WorkspaceBackdrop>,
    );

    expect(screen.queryByTestId('workspace-wallpaper')).not.toBeInTheDocument();
  });

  it('follows the live preview so a wallpaper choice is visible immediately', () => {
    state.workspace = defaultWorkspace();
    state.preview = withWallpaper('sunset');

    render(
      <WorkspaceBackdrop>
        <div>home</div>
      </WorkspaceBackdrop>,
    );

    expect(screen.getByTestId('workspace-wallpaper')).toBeInTheDocument();
  });
});
