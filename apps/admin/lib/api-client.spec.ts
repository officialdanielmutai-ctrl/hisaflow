import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from './api-client';

const realFetch = globalThis.fetch;
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

describe('adminFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('serialises query params and skips empty values', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await adminFetch('/directory', {
      params: { search: 'acme', page: 2, empty: '', missing: undefined, flag: true },
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/directory?search=acme&page=2&flag=true`);
  });

  it('adds the JSON content type and bearer token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await adminFetch('accounts', { token: 'tok_1' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok_1',
    });
  });

  it('returns the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [1, 2] }) });

    await expect(adminFetch('/x')).resolves.toEqual({ items: [1, 2] });
  });

  it('throws with the server message on an error response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'No access' }),
    });

    await expect(adminFetch('/x')).rejects.toThrow('API Error [403]: No access');
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(adminFetch('/x')).rejects.toThrow('API Error [500]: Server Error');
  });
});
