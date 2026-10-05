import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FeatureLockedError,
  SessionRevokedError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  getImpersonationToken,
} from './api-client';

const assignMock = vi.fn();

describe('frontend api-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    sessionStorage.clear();
    vi.stubGlobal('location', { assign: assignMock, href: 'http://localhost/' });
    assignMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const okJson = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body });
  const errJson = (status: number, body: unknown = {}) => ({ ok: false, status, json: async () => body });

  it('apiGet sends the auth + organisation headers and returns JSON', async () => {
    fetchMock.mockResolvedValue(okJson({ items: [1] }));

    await expect(apiGet('/inventory', 'tok', 'org_1')).resolves.toEqual({ items: [1] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/inventory');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'x-organization-id': 'org_1',
      'Content-Type': 'application/json',
    });
  });

  it('apiGet forwards an active impersonation token', async () => {
    sessionStorage.setItem('hf:impersonation_token', 'imp_1');
    fetchMock.mockResolvedValue(okJson());

    await apiGet('/x', 'tok', 'org_1');

    expect(fetchMock.mock.calls[0][1].headers['x-impersonation-token']).toBe('imp_1');
  });

  it.each([
    ['apiPost', apiPost],
    ['apiPatch', apiPatch],
    ['apiPut', apiPut],
    ['apiDelete', apiDelete],
  ])('%s is blocked in read-only View-As mode without calling the network', async (_name, fn) => {
    sessionStorage.setItem('hf:impersonation_token', 'imp_1');

    await expect((fn as any)('/x', 'tok', 'org_1', {})).rejects.toThrow(/read-only/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('apiDelete returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    await expect(apiDelete('/x', 'tok', 'org_1')).resolves.toBeUndefined();
  });

  it('turns a 403 feature-lock into FeatureLockedError and redirects to the paywall', async () => {
    fetchMock.mockResolvedValue(
      errJson(403, { paywallUrl: '/paywall?feature=multi-location', message: 'Locked', reason: 'tier' }),
    );

    await expect(apiGet('/x', 'tok', 'org_1')).rejects.toBeInstanceOf(FeatureLockedError);
    expect(assignMock).toHaveBeenCalledWith('/paywall?feature=multi-location');
  });

  it('turns a 403 membership error into SessionRevokedError', async () => {
    fetchMock.mockResolvedValue(errJson(403, { message: 'No membership found for this organization' }));

    await expect(apiGet('/x', 'tok', 'org_1')).rejects.toBeInstanceOf(SessionRevokedError);
  });

  it('turns a 401 into SessionRevokedError', async () => {
    fetchMock.mockResolvedValue(errJson(401, {}));

    await expect(apiGet('/x', 'tok', 'org_1')).rejects.toBeInstanceOf(SessionRevokedError);
  });

  it('surfaces a generic API error message otherwise', async () => {
    fetchMock.mockResolvedValue(errJson(500, { message: 'Boom' }));

    await expect(apiGet('/x', 'tok', 'org_1')).rejects.toThrow('Boom');
  });

  it('getImpersonationToken reads the session key', () => {
    expect(getImpersonationToken()).toBeNull();
    sessionStorage.setItem('hf:impersonation_token', 'imp_9');
    expect(getImpersonationToken()).toBe('imp_9');
  });
});
