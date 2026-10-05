import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks so the module factory can reference them ──────────────────
const { decodeMock, pushMock } = vi.hoisted(() => ({
  decodeMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoElement: decodeMock,
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ membership: { organization: { id: 'org_1' } } }),
}));

// Vaul's Drawer is a portal-based primitive that needs a real DOM/stacking
// context; for behaviour tests we only need its children mounted.
vi.mock('vaul', async () => {
  const ReactActual = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement(ReactActual.Fragment, null, children);
  return {
    Drawer: {
      Root: passthrough,
      Portal: passthrough,
      Overlay: () => null,
      Content: passthrough,
      Close: passthrough,
    },
  };
});

import BarcodeScannerSheet from './BarcodeScannerSheet';
import { BrowserMultiFormatReader } from '@zxing/browser';

const MockedReader = BrowserMultiFormatReader as unknown as ReturnType<typeof vi.fn>;

const CODE = '1234567890';
const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

function scan(callback: (result: { getText: () => string }, error?: unknown) => void, code = CODE, times = 5) {
  act(() => {
    for (let i = 0; i < times; i += 1) {
      callback({ getText: () => code });
    }
  });
}

describe('BarcodeScannerSheet (camera capture logic)', () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    decodeMock.mockReset();
    pushMock.mockReset();
    onOpenChange = vi.fn();

    // `restoreMocks: true` clears the factory implementation before every test,
    // so re-arm the constructor here.
    MockedReader.mockImplementation(() => ({ decodeFromVideoElement: decodeMock }));

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => fakeStream) },
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderOpen() {
    render(<BarcodeScannerSheet open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(decodeMock).toHaveBeenCalled());
    return decodeMock.mock.calls[0][1] as (
      result: { getText: () => string },
      error?: unknown,
    ) => void;
  }

  it('navigates to the scanned item when the lookup succeeds', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'item_1' }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callback = await renderOpen();
    scan(callback);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/inventory?scannedItemId=item_1'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/inventory/barcode/1234567890'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-organization-id': 'org_1' }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('routes to the add-item flow when the barcode is unknown (404)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callback = await renderOpen();
    scan(callback);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/inventory?action=add&barcode=1234567890'),
    );
  });

  it('requires the same code in 5 consecutive frames before scanning', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'x' }) }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callback = await renderOpen();
    scan(callback, CODE, 4);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();

    scan(callback, CODE, 1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('ignores partial reads shorter than 6 characters', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'x' }) }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callback = await renderOpen();
    scan(callback, '123', 10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a server error and allows scanning again', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Lookup failed' }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callback = await renderOpen();
    scan(callback);

    await waitFor(() => expect(screen.getByText('Lookup failed')).toBeTruthy());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
