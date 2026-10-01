import { resolveFeatureLock } from './feature-lock';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Thrown when the server indicates the user's membership has been revoked
 * (403 with a message containing "membership" or "No membership found").
 * Distinguished from a generic auth error so the UI can show a specific
 * "you've been removed" screen rather than a raw error.
 */
export class SessionRevokedError extends Error {
  constructor(message = 'Your access to this organisation has been revoked.') {
    super(message);
    this.name = 'SessionRevokedError';
  }
}

/**
 * A tier/seat gate blocked the action. Carries the exact paywall URL the
 * backend built (reason + feature), so the client can route there with the
 * blocked action still attached (Section 2.1).
 */
export class FeatureLockedError extends Error {
  readonly paywallUrl: string;
  constructor(message: string, paywallUrl: string) {
    super(message);
    this.name = 'FeatureLockedError';
    this.paywallUrl = paywallUrl;
  }
}

/**
 * Routes straight into the in-context paywall. The doc is explicit that a
 * gate must not dead-end on a generic pricing page, so this happens centrally
 * rather than relying on every call site to remember.
 */
function featureLocked(
  body: Record<string, unknown> | null,
): FeatureLockedError | null {
  const lock = resolveFeatureLock(body);
  if (!lock) return null;

  const error = new FeatureLockedError(lock.message, lock.paywallUrl);
  if (typeof window !== 'undefined') {
    window.location.assign(lock.paywallUrl);
  }
  return error;
}

async function readErrorBody(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const body = (await response.json()) as unknown;
    return body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await readErrorBody(response);
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `API error: ${response.status}`;

    // Tier/seat gate → in-context paywall.
    if (response.status === 403) {
      const lockError = featureLocked(body);
      if (lockError) throw lockError;
    }

    // 403 with membership-related message → session revoked
    if (
      response.status === 403 &&
      typeof message === 'string' &&
      (message.toLowerCase().includes('membership') || message.toLowerCase().includes('revoked'))
    ) {
      throw new SessionRevokedError(message);
    }

    // 401 → treat as session revoked too (Clerk rejected the token after revocation)
    if (response.status === 401) {
      throw new SessionRevokedError('Your session has expired or been revoked. Please sign in again.');
    }

    throw new Error(message);
  }

  return response.json() as T;
}

export function getImpersonationToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('hf:impersonation_token');
  } catch {
    return null;
  }
}

export async function apiGet<T>(
  path: string,
  token: string,
  organizationId: string
): Promise<T> {
  const impToken = getImpersonationToken();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'x-organization-id': organizationId,
    'Content-Type': 'application/json',
  };
  if (impToken) {
    headers['x-impersonation-token'] = impToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers,
  });
  return handleResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  token: string,
  organizationId: string,
  body: unknown
): Promise<T> {
  const impToken = getImpersonationToken();
  if (impToken) {
    throw new Error('Admin View-As mode is read-only. Mutations are disabled.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-organization-id': organizationId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T>(
  path: string,
  token: string,
  organizationId: string,
  body: unknown
): Promise<T> {
  const impToken = getImpersonationToken();
  if (impToken) {
    throw new Error('Admin View-As mode is read-only. Mutations are disabled.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-organization-id': organizationId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPut<T>(
  path: string,
  token: string,
  organizationId: string,
  body: unknown
): Promise<T> {
  const impToken = getImpersonationToken();
  if (impToken) {
    throw new Error('Admin View-As mode is read-only. Mutations are disabled.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-organization-id': organizationId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(
  path: string,
  token: string,
  organizationId: string,
): Promise<T> {
  const impToken = getImpersonationToken();
  if (impToken) {
    throw new Error('Admin View-As mode is read-only. Mutations are disabled.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-organization-id': organizationId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `API error: ${response.status}`;

    if (response.status === 403) {
      const lockError = featureLocked(body);
      if (lockError) throw lockError;
    }
    if (response.status === 403 && message.toLowerCase().includes('membership')) {
      throw new SessionRevokedError(message);
    }
    if (response.status === 401) {
      throw new SessionRevokedError('Your session has expired or been revoked.');
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as T;
}
