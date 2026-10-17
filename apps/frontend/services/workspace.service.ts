import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from '@/lib/api-client';
import type {
  UserWorkspace,
  WorkspaceResponse,
} from '@hisaflow/types';

export async function getWorkspace(
  token: string,
  organizationId: string,
): Promise<UserWorkspace | null> {
  const response = await apiGet<WorkspaceResponse>('/workspace', token, organizationId);
  return response.workspace;
}

export async function putWorkspace(
  token: string,
  organizationId: string,
  workspace: UserWorkspace,
): Promise<UserWorkspace> {
  const response = await apiPut<WorkspaceResponse>('/workspace', token, organizationId, {
    workspace,
  });
  return response.workspace as UserWorkspace;
}

export async function resetWorkspace(
  token: string,
  organizationId: string,
  scope: 'layout' | 'all',
): Promise<UserWorkspace | null> {
  const response = await apiPost<WorkspaceResponse>(
    '/workspace/reset',
    token,
    organizationId,
    { scope },
  );
  return response.workspace;
}

export async function createWorkspaceLayout(
  token: string,
  organizationId: string,
  input: { name: string; templateId?: string; breakpoints?: unknown },
): Promise<UserWorkspace> {
  const response = await apiPost<WorkspaceResponse>(
    '/workspace/layouts',
    token,
    organizationId,
    input,
  );
  return response.workspace as UserWorkspace;
}

export async function updateWorkspaceLayout(
  token: string,
  organizationId: string,
  layoutId: string,
  input: { name?: string; templateId?: string; breakpoints?: unknown },
): Promise<UserWorkspace> {
  const response = await apiPatch<WorkspaceResponse>(
    `/workspace/layouts/${encodeURIComponent(layoutId)}`,
    token,
    organizationId,
    input,
  );
  return response.workspace as UserWorkspace;
}

export async function deleteWorkspaceLayout(
  token: string,
  organizationId: string,
  layoutId: string,
): Promise<void> {
  await apiDelete<void>(
    `/workspace/layouts/${encodeURIComponent(layoutId)}`,
    token,
    organizationId,
  );
}

export async function duplicateWorkspaceLayout(
  token: string,
  organizationId: string,
  layoutId: string,
): Promise<UserWorkspace> {
  const response = await apiPost<WorkspaceResponse>(
    `/workspace/layouts/${encodeURIComponent(layoutId)}/duplicate`,
    token,
    organizationId,
    {},
  );
  return response.workspace as UserWorkspace;
}
