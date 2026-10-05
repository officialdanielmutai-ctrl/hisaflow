import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockMembership: { organization: { id: string } } | null = { organization: { id: 'org_1' } };
let mockToken: string | null = 'token';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => mockToken }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ membership: mockMembership }),
}));

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (blob: Blob) => blob),
}));

vi.mock('@/services/ai-ingestion.service', () => ({
  parseInventoryText: vi.fn(),
}));

import imageCompression from 'browser-image-compression';
import { parseInventoryText } from '@/services/ai-ingestion.service';
import { useLabelOcrCapture } from './useLabelOcrCapture';

const ocrResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => body } as Response);

describe('useLabelOcrCapture (OCR / label-scan flow)', () => {
  beforeEach(() => {
    mockMembership = { organization: { id: 'org_1' } };
    mockToken = 'token';
    vi.mocked(parseInventoryText).mockReset();
    vi.mocked(imageCompression).mockClear();
  });

  it('maps a CREATE action from the label OCR into a normalized draft', async () => {
    globalThis.fetch = vi.fn(() => ocrResponse({ text: 'SUGAR 2KG EXP 12/2027 BATCH B1' })) as unknown as typeof fetch;
    vi.mocked(parseInventoryText).mockResolvedValue([
      {
        itemId: null,
        itemName: 'Sugar',
        type: 'CREATE',
        quantity: 1,
        confidence: 'HIGH',
        category: 'dry goods',
        unit: 'kg',
        metadata: { expiryDate: '2027-12', batchNumber: 'B1' },
      },
    ]);

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: Awaited<ReturnType<typeof result.current.processImage>> = null;
    await act(async () => {
      returned = await result.current.processImage(new Blob(['image-bytes']));
    });

    expect(returned).toEqual({
      name: 'Sugar',
      category: 'dry goods',
      unit: 'kg',
      expiryDate: '2027-12-01',
      batchNumber: 'B1',
    });
    expect(imageCompression).toHaveBeenCalledTimes(1);
    expect(parseInventoryText).toHaveBeenCalledWith(
      'SUGAR 2KG EXP 12/2027 BATCH B1',
      'token',
      'org_1',
      'LABEL_OCR',
    );
  });

  it('drops an unparseable expiry date instead of sending a bad value', async () => {
    globalThis.fetch = vi.fn(() => ocrResponse({ text: 'some text' })) as unknown as typeof fetch;
    vi.mocked(parseInventoryText).mockResolvedValue([
      {
        itemId: null,
        itemName: 'Milk',
        type: 'CREATE',
        quantity: 1,
        confidence: 'LOW',
        metadata: { expiryDate: 'sometime soon' },
      },
    ]);

    const { result } = renderHook(() => useLabelOcrCapture());
    const captured: { value: Awaited<ReturnType<typeof result.current.processImage>> } = {
      value: null,
    };
    await act(async () => {
      captured.value = await result.current.processImage(new Blob(['x']));
    });

    expect(captured.value?.expiryDate).toBeNull();
  });

  it('returns null when there is no active organisation', async () => {
    mockMembership = null;
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns null when the OCR endpoint fails', async () => {
    globalThis.fetch = vi.fn(() => ocrResponse({}, false)) as unknown as typeof fetch;

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });

  it('returns null when OCR returns no text', async () => {
    globalThis.fetch = vi.fn(() => ocrResponse({ text: '   ' })) as unknown as typeof fetch;

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });

  it('returns null when the AI parser finds no CREATE action', async () => {
    globalThis.fetch = vi.fn(() => ocrResponse({ text: 'some text' })) as unknown as typeof fetch;
    vi.mocked(parseInventoryText).mockResolvedValue([
      { itemId: 'i1', itemName: 'Sugar', type: 'SALE', quantity: 1, confidence: 'HIGH' },
    ]);

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });
});
