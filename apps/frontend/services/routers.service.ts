import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

export type RouterStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface Router {
  id: string;
  organizationId: string;
  label: string;
  host: string;
  port: number;
  apiUsername: string;
  connectionStatus: RouterStatus;
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    subscribers: number;
  };
}

export interface CreateRouterInput {
  label: string;
  host: string;
  port?: number;
  apiUsername: string;
  apiPassword: string;
}

export interface UpdateRouterInput {
  label?: string;
  host?: string;
  port?: number;
  apiUsername?: string;
  apiPassword?: string;
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs?: number;
  routerIdentity?: string;
  error?: string;
}

export function getRouters(token: string, orgId: string): Promise<Router[]> {
  return apiGet<Router[]>('/routers', token, orgId);
}

export function createRouter(token: string, orgId: string, data: CreateRouterInput): Promise<Router> {
  return apiPost<Router>('/routers', token, orgId, data);
}

export function updateRouter(
  token: string,
  orgId: string,
  id: string,
  data: UpdateRouterInput,
): Promise<Router> {
  return apiPatch<Router>(`/routers/${id}`, token, orgId, data);
}

export function deleteRouter(token: string, orgId: string, id: string): Promise<void> {
  return apiDelete<void>(`/routers/${id}`, token, orgId);
}

export function testRouterConnection(
  token: string,
  orgId: string,
  id: string,
): Promise<TestConnectionResult> {
  return apiPost<TestConnectionResult>(`/routers/${id}/test`, token, orgId, {});
}
