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

import imageCompression from 'browser-image-compression';
import { ocrAndParseImage } from '@/services/ocr.service';
import { useLabelOcrCapture } from './useLabelOcrCapture';

describe('useLabelOcrCapture (OCR / label-scan flow)', () => {
  beforeEach(() => {
    mockMembership = { organization: { id: 'org_1' } };
    mockToken = 'token';
    vi.mocked(ocrAndParseImage).mockReset();
    vi.mocked(imageCompression).mockClear();
  });

  it('maps a CREATE action from the label OCR into a normalized draft', async () => {
    vi.mocked(ocrAndParseImage).mockResolvedValue({
      text: 'SUGAR 2KG EXP 12/2027 BATCH B1',
      actions: [
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
      ],
    });

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
    expect(ocrAndParseImage).toHaveBeenCalledWith(
      expect.any(Blob),
      'token',
      'org_1',
      'LABEL_OCR',
    );
  });

  it('drops an unparseable expiry date instead of sending a bad value', async () => {
    vi.mocked(ocrAndParseImage).mockResolvedValue({
      text: 'some text',
      actions: [
        {
          itemId: null,
          itemName: 'Milk',
          type: 'CREATE',
          quantity: 1,
          confidence: 'LOW',
          metadata: { expiryDate: 'sometime soon' },
        },
      ],
    });

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

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
    expect(ocrAndParseImage).not.toHaveBeenCalled();
  });

  it('returns null when the OCR service fails', async () => {
    vi.mocked(ocrAndParseImage).mockRejectedValue(new Error('Failed to process image'));

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });

  it('returns null when OCR returns no text', async () => {
    vi.mocked(ocrAndParseImage).mockResolvedValue({ text: '   ', actions: [] });

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });

  it('returns null when the AI parser finds no CREATE action', async () => {
    vi.mocked(ocrAndParseImage).mockResolvedValue({
      text: 'some text',
      actions: [
        { itemId: 'i1', itemName: 'Sugar', type: 'SALE', quantity: 1, confidence: 'HIGH' },
      ],
    });

    const { result } = renderHook(() => useLabelOcrCapture());
    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.processImage(new Blob(['x']));
    });

    expect(returned).toBeNull();
  });
});
