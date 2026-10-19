'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTheme } from '@/components/providers/ThemeProvider';
import { wallpaperById } from '@/lib/workspace';

/**
 * Applies the chosen wallpaper to the whole Home content area (not just the
 * KPI strip), and follows the live edit draft so a wallpaper choice is visible
 * immediately. Other dashboard screens keep solid surfaces.
 */
export function WorkspaceBackdrop({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace, preview } = useWorkspace();
  const { theme } = useTheme();

  const rendered = preview ?? workspace;
  const isHome = pathname === '/dashboard' || pathname === '/dashboard/';
  const wallpaper = wallpaperById(rendered?.wallpaper.id);
  const active = isHome && rendered !== null && rendered.wallpaper.id !== 'default';

  return (
    <div
      data-testid={active ? 'workspace-wallpaper' : undefined}
      className={
        active
          ? 'min-h-[calc(100vh-9rem)] transition-colors duration-300'
          : undefined
      }
      style={
        active
          ? {
              background: theme === 'dark' ? wallpaper.dark : wallpaper.light,
              backgroundAttachment: 'fixed',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export default WorkspaceBackdrop;
