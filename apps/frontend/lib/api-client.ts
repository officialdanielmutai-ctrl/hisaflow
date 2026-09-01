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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `API error: ${response.status}`;
    let body: any = null;
    try {
      body = await response.json();
      message = body?.message || message;
    } catch {}

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

export async function apiGet<T>(
  path: string,
  token: string,
  organizationId: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-organization-id': organizationId,
      'Content-Type': 'application/json',
    },
  });
  return handleResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  token: string,
  organizationId: string,
  body: unknown
): Promise<T> {
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

export async function apiDelete<T>(
  path: string,
  token: string,
  organizationId: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-organization-id': organizationId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {}

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
