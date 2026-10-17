'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import type { UserWorkspace } from '@hisaflow/types';
import { useMyOrganization } from './useMyOrganization';
import { defaultWorkspace, parseCachedWorkspace } from '@/lib/workspace';
import {
  createWorkspaceLayout,
  deleteWorkspaceLayout,
  duplicateWorkspaceLayout,
  getWorkspace,
  putWorkspace,
  resetWorkspace,
  updateWorkspaceLayout,
} from '@/services/workspace.service';

const CACHE_PREFIX = 'hisaflow.workspace:';

interface WorkspaceContextValue {
  /** False when no WorkspaceProvider is mounted (e.g. marketing previews). */
  enabled: boolean;
  workspace: UserWorkspace | null;
  loading: boolean;
  error: string | null;
  hasSavedWorkspace: boolean;
  save: (next: UserWorkspace) => Promise<UserWorkspace>;
  reset: (scope: 'layout' | 'all') => Promise<UserWorkspace | null>;
  createLayout: (input: {
    name: string;
    templateId?: string;
    breakpoints?: unknown;
  }) => Promise<UserWorkspace>;
  updateLayout: (
    layoutId: string,
    input: { name?: string; templateId?: string; breakpoints?: unknown },
  ) => Promise<UserWorkspace>;
  deleteLayout: (layoutId: string) => Promise<UserWorkspace | null>;
  duplicateLayout: (layoutId: string) => Promise<UserWorkspace>;
}

const noopSave = async (next: UserWorkspace) => next;
const noopLoad = async () => defaultWorkspace();
const noopNullable = async () => null;

const WorkspaceContext = createContext<WorkspaceContextValue>({
  enabled: false,
  workspace: null,
  loading: false,
  error: null,
  hasSavedWorkspace: false,
  save: noopSave,
  reset: noopNullable,
  createLayout: noopLoad,
  updateLayout: noopLoad,
  deleteLayout: noopNullable,
  duplicateLayout: noopLoad,
});

function cacheKey(organizationId: string) {
  return `${CACHE_PREFIX}${organizationId}`;
}

function readCache(organizationId: string | null): UserWorkspace | null {
  if (!organizationId) return null;
  try {
    return parseCachedWorkspace(localStorage.getItem(cacheKey(organizationId)));
  } catch {
    return null;
  }
}

function writeCache(organizationId: string | null, workspace: UserWorkspace | null) {
  if (!organizationId) return;
  try {
    if (workspace) localStorage.setItem(cacheKey(organizationId), JSON.stringify(workspace));
    else localStorage.removeItem(cacheKey(organizationId));
  } catch {
    // Storage can be unavailable (private mode); the in-memory value still works.
  }
}

/**
 * Loads the signed-in user's Home workspace for the active organisation.
 *
 * Server is authoritative; a localStorage cache gives instant paint while the
 * request is in flight. Edits are saved explicitly (on Done), never on every
 * interaction. A null workspace means "never customised", so Home keeps its
 * built-in default.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { membership, loading: orgLoading } = useMyOrganization();
  const organizationId = membership?.organization.id ?? null;

  const [cached, setCached] = useState<UserWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCached(readCache(organizationId));
  }, [organizationId]);

  const { data, isLoading, mutate } = useSWR<UserWorkspace | null>(
    organizationId ? ['workspace', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getWorkspace(token, organizationId!);
    },
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  useEffect(() => {
    if (data !== undefined) {
      setCached(data);
      writeCache(organizationId, data);
    }
  }, [data, organizationId]);

  const workspace = data !== undefined ? data : cached;

  const commit = useCallback(
    (next: UserWorkspace | null) => {
      setCached(next);
      writeCache(organizationId, next);
      void mutate(next, { revalidate: false });
    },
    [mutate, organizationId],
  );

  const withToken = useCallback(
    async <T,>(action: (token: string, orgId: string) => Promise<T>): Promise<T> => {
      if (!organizationId) throw new Error('No active organisation.');
      const token = await getToken();
      if (!token) throw new Error('Not authenticated.');
      setError(null);
      try {
        return await action(token, organizationId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Workspace request failed.';
        setError(message);
        throw err;
      }
    },
    [getToken, organizationId],
  );

  const save = useCallback(
    async (next: UserWorkspace) => {
      const saved = await withToken((token, orgId) => putWorkspace(token, orgId, next));
      commit(saved);
      return saved;
    },
    [commit, withToken],
  );

  const reset = useCallback(
    async (scope: 'layout' | 'all') => {
      const next = await withToken((token, orgId) =>
        resetWorkspace(token, orgId, scope),
      );
      commit(next);
      return next;
    },
    [commit, withToken],
  );

  const createLayout = useCallback(
    async (input: { name: string; templateId?: string; breakpoints?: unknown }) => {
      const next = await withToken((token, orgId) =>
        createWorkspaceLayout(token, orgId, input),
      );
      commit(next);
      return next;
    },
    [commit, withToken],
  );

  const updateLayout = useCallback(
    async (
      layoutId: string,
      input: { name?: string; templateId?: string; breakpoints?: unknown },
    ) => {
      const next = await withToken((token, orgId) =>
        updateWorkspaceLayout(token, orgId, layoutId, input),
      );
      commit(next);
      return next;
    },
    [commit, withToken],
  );

  const deleteLayout = useCallback(
    async (layoutId: string) => {
      const next = await withToken(async (token, orgId) => {
        await deleteWorkspaceLayout(token, orgId, layoutId);
        return getWorkspace(token, orgId);
      });
      commit(next);
      return next;
    },
    [commit, withToken],
  );

  const duplicateLayout = useCallback(
    async (layoutId: string) => {
      const next = await withToken((token, orgId) =>
        duplicateWorkspaceLayout(token, orgId, layoutId),
      );
      commit(next);
      return next;
    },
    [commit, withToken],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      enabled: true,
      workspace,
      loading: orgLoading || (organizationId !== null && isLoading && workspace === null),
      error,
      hasSavedWorkspace: workspace !== null,
      save,
      reset,
      createLayout,
      updateLayout,
      deleteLayout,
      duplicateLayout,
    }),
    [
      workspace,
      orgLoading,
      organizationId,
      isLoading,
      error,
      save,
      reset,
      createLayout,
      updateLayout,
      deleteLayout,
      duplicateLayout,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}
