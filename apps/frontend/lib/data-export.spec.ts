import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadOwnerExport } from './data-export';

describe('downloadOwnerExport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    clickMock = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickMock);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends org auth headers and downloads the named CSV', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name === 'content-disposition'
            ? 'attachment; filename="inventory.csv"'
            : null,
      },
      blob: async () => new Blob(['item,quantity\nSugar,3']),
    });

    await downloadOwnerExport('inventory', 'tok', 'org_1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/exports/inventory');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'x-organization-id': 'org_1',
    });
    expect(clickMock).toHaveBeenCalledTimes(1);
  });

  it('reports a failed export instead of downloading an error page', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    await expect(
      downloadOwnerExport('tax', 'tok', 'org_1'),
    ).rejects.toThrow('Export failed (403)');
    expect(clickMock).not.toHaveBeenCalled();
  });
});
