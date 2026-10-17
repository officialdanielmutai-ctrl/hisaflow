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

vi.mock('@/services/ocr.service', () => ({
  ocrAndParseImage: vi.fn(),
}));

import { ocrAndParseImage } from '@/services/ocr.service';
import { useReceiptOcrCapture } from './useReceiptOcrCapture';

describe('useReceiptOcrCapture (list/receipt scan flow)', () => {
  beforeEach(() => {
    mockMembership = { organization: { id: 'org_1' } };
    mockToken = 'token';
    vi.mocked(ocrAndParseImage).mockReset();
  });

  it('keeps every parsed line so the batch table can show them all', async () => {
    vi.mocked(ocrAndParseImage).mockResolvedValue({
      text: 'Sugar 2\nRice 5',
      actions: [
        { itemId: null, itemName: 'Sugar', type: 'CREATE', quantity: 2, confidence: 'HIGH' },
        { itemId: 'item_2', itemName: 'Rice', type: 'PURCHASE', quantity: 5, confidence: 'HIGH' },
      ],
    });

    const { result } = renderHook(() => useReceiptOcrCapture());
    const captured: { value: Awaited<ReturnType<typeof result.current.processImage>> } = {
      value: null,
    };
    await act(async () => {
      captured.value = await result.current.processImage(new Blob(['image-bytes']));
    });

    expect(captured.value?.actions).toHaveLength(2);
    expect(captured.value?.text).toBe('Sugar 2\nRice 5');
    expect(ocrAndParseImage).toHaveBeenCalledWith(
      expect.any(Blob),
      'token',
      'org_1',
      'RECEIPT_OCR',
    );
  });

  it('returns null when the photo yields no line items', async () => {
    vi.mocked(ocrAndParseImage).mockResolvedValue({ text: 'blurry', actions: [] });

    const { result } = renderHook(() => useReceiptOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });

  it('returns null when there is no active organisation', async () => {
    mockMembership = null;

    const { result } = renderHook(() => useReceiptOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
    expect(ocrAndParseImage).not.toHaveBeenCalled();
  });
});
