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
const PENDING_PREFIX = 'hisaflow.workspace:pending:';

/**
 * Errors the server will reject again on retry (plan limit, validation, auth).
 * These should revert locally instead of queuing forever; network/5xx errors
 * are the ones worth keeping in the offline queue.
 */
function isPermanentWorkspaceError(message: string): boolean {
  return /plan allows|exceeds|cannot contain|schemaVersion|must be|invalid|not authenticated|no active organisation|membership|revoked/i.test(
    message,
  );
}

interface WorkspaceContextValue {
  /** False when no WorkspaceProvider is mounted (e.g. marketing previews). */
  enabled: boolean;
  workspace: UserWorkspace | null;
  /**
   * Unsaved live draft used by the Home editor. Consumers render
   * `preview ?? workspace` so changes appear immediately while editing.
   */
  preview: UserWorkspace | null;
  setPreview: (workspace: UserWorkspace | null) => void;
  loading: boolean;
  error: string | null;
  /** True when a local edit is waiting for a server sync. */
  pendingSync: boolean;
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
  preview: null,
  setPreview: () => undefined,
  loading: false,
  error: null,
  pendingSync: false,
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

function pendingKey(organizationId: string) {
  return `${PENDING_PREFIX}${organizationId}`;
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

function readPending(organizationId: string | null): UserWorkspace | null {
  if (!organizationId) return null;
  try {
    return parseCachedWorkspace(localStorage.getItem(pendingKey(organizationId)));
  } catch {
    return null;
  }
}

function writePending(organizationId: string | null, workspace: UserWorkspace) {
  if (!organizationId) return;
  try {
    localStorage.setItem(pendingKey(organizationId), JSON.stringify(workspace));
  } catch {
    // Ignore storage failures; the in-memory cache still shows the edit.
  }
}

function clearPending(organizationId: string | null) {
  if (!organizationId) return;
  try {
    localStorage.removeItem(pendingKey(organizationId));
  } catch {
    // Ignore.
  }
}

/**
 * Loads the signed-in user's Home workspace for the active organisation.
 *
 * Server is authoritative, but edits are applied optimistically so the Home
 * updates the moment the user taps Done. If the save cannot reach the server,
 * the local edit is kept and queued (`pendingSync`) to retry on reconnect —
 * this is the directive's "local cache + last-write-wins" behaviour.
 *
 * `preview` is the unsaved draft used by the inline editor; it is never
 * persisted and is cleared on Done/Cancel.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { membership, loading: orgLoading } = useMyOrganization();
  const organizationId = membership?.organization.id ?? null;

  const [cached, setCached] = useState<UserWorkspace | null>(null);
  const [pending, setPending] = useState<UserWorkspace | null>(null);
  const [preview, setPreview] = useState<UserWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const queued = readPending(organizationId);
    setPending(queued);
    setCached(queued ?? readCache(organizationId));
    setPreview(null);
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
    if (data === undefined) return;
    // Never let a server read overwrite a local edit that has not synced yet.
    if (pending) return;
    setCached(data);
    writeCache(organizationId, data);
  }, [data, organizationId, pending]);

  // Retry a queued local edit on mount and whenever the browser comes online.
  useEffect(() => {
    if (!organizationId || !pending) return;

    let cancelled = false;
    const sync = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const saved = await putWorkspace(token, organizationId, pending);
        if (cancelled) return;
        clearPending(organizationId);
        setPending(null);
        setCached(saved);
        writeCache(organizationId, saved);
        void mutate(saved, { revalidate: false });
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Workspace sync failed.';
        if (isPermanentWorkspaceError(message)) {
          // The server will reject this again; stop retrying and surface it.
          clearPending(organizationId);
          setPending(null);
          setError(message);
        }
        // Otherwise keep the queued edit; the online listener will try again.
      }
    };

    void sync();
    window.addEventListener('online', sync);
    return () => {
      cancelled = true;
      window.removeEventListener('online', sync);
    };
  }, [organizationId, pending, getToken, mutate]);

  const workspace = pending ?? (data !== undefined ? data : cached);

  const commitLocal = useCallback(
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
      if (!organizationId) throw new Error('No active organisation.');
      const token = await getToken();
      if (!token) throw new Error('Not authenticated.');

      const previous = workspace;

      // Optimistic: Home reflects the edit immediately, before the network.
      commitLocal(next);

      try {
        const saved = await putWorkspace(token, organizationId, next);
        clearPending(organizationId);
        setPending(null);
        commitLocal(saved);
        setError(null);
        return saved;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Workspace save failed.';

        if (isPermanentWorkspaceError(message)) {
          // Plan limit / validation / auth: revert and let the editor show it.
          commitLocal(previous);
          setError(message);
          throw err;
        }

        // Network/5xx: keep the edit locally and queue it; never lose the work.
        console.error('Workspace save failed, queued locally:', err);
        writePending(organizationId, next);
        setPending(next);
        setError('Saved on this device — we will sync it when the connection is back.');
        return next;
      }
    },
    [commitLocal, getToken, organizationId, workspace],
  );

  const reset = useCallback(
    async (scope: 'layout' | 'all') => {
      const next = await withToken((token, orgId) =>
        resetWorkspace(token, orgId, scope),
      );
      clearPending(organizationId);
      setPending(null);
      commitLocal(next);
      return next;
    },
    [commitLocal, organizationId, withToken],
  );

  const createLayout = useCallback(
    async (input: { name: string; templateId?: string; breakpoints?: unknown }) => {
      const next = await withToken((token, orgId) =>
        createWorkspaceLayout(token, orgId, input),
      );
      commitLocal(next);
      return next;
    },
    [commitLocal, withToken],
  );

  const updateLayout = useCallback(
    async (
      layoutId: string,
      input: { name?: string; templateId?: string; breakpoints?: unknown },
    ) => {
      const next = await withToken((token, orgId) =>
        updateWorkspaceLayout(token, orgId, layoutId, input),
      );
      commitLocal(next);
      return next;
    },
    [commitLocal, withToken],
  );

  const deleteLayout = useCallback(
    async (layoutId: string) => {
      const next = await withToken(async (token, orgId) => {
        await deleteWorkspaceLayout(token, orgId, layoutId);
        return getWorkspace(token, orgId);
      });
      commitLocal(next);
      return next;
    },
    [commitLocal, withToken],
  );

  const duplicateLayout = useCallback(
    async (layoutId: string) => {
      const next = await withToken((token, orgId) =>
        duplicateWorkspaceLayout(token, orgId, layoutId),
      );
      commitLocal(next);
      return next;
    },
    [commitLocal, withToken],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      enabled: true,
      workspace,
      preview,
      setPreview,
      loading: orgLoading || (organizationId !== null && isLoading && workspace === null),
      error,
      pendingSync: pending !== null,
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
      preview,
      orgLoading,
      organizationId,
      isLoading,
      error,
      pending,
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
