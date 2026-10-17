import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({
    membership: { organization: { id: 'org_1', businessType: 'DUKA' } },
  }),
}));

vi.mock('@/services/ai-ingestion.service', () => ({
  parseInventoryText: vi.fn(),
  captureUtterance: vi.fn(),
}));
vi.mock('@/services/transactions.service', () => ({ logTransaction: vi.fn() }));
vi.mock('@/services/inventory.service', () => ({
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
}));
vi.mock('@/services/notes.service', () => ({ createNote: vi.fn() }));
vi.mock('@/services/guests.service', () => ({ guestsService: { create: vi.fn() } }));
vi.mock('@/services/rooms.service', () => ({ roomsService: { create: vi.fn() } }));
vi.mock('@/services/ocr.service', () => ({ ocrAndParseImage: vi.fn() }));
vi.mock('browser-image-compression', () => ({ default: vi.fn() }));

import AiIngestionPanel from './AiIngestionPanel';
import {
  RECEIPT_DRAFT_EVENT,
  RECEIPT_DRAFT_STORAGE_KEY,
} from '@/hooks/useReceiptOcrCapture';

describe('AiIngestionPanel — global receipt handoff', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders the batch table for a stashed receipt and clears the stash', async () => {
    sessionStorage.setItem(
      RECEIPT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        text: 'Sugar 2\nRice 5',
        actions: [
          { itemId: null, itemName: 'Sugar', type: 'CREATE', quantity: 2, confidence: 'HIGH' },
          { itemId: null, itemName: 'Rice', type: 'CREATE', quantity: 5, confidence: 'HIGH' },
        ],
      }),
    );

    render(<AiIngestionPanel onCompleted={vi.fn()} />);

    expect(await screen.findByDisplayValue('Sugar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rice')).toBeInTheDocument();
    expect(screen.getByText('Review scanned items')).toBeInTheDocument();
    expect(sessionStorage.getItem(RECEIPT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('applies a receipt stashed while the panel is already mounted (same-page scan)', async () => {
    render(<AiIngestionPanel onCompleted={vi.fn()} />);

    sessionStorage.setItem(
      RECEIPT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        text: 'Milk 3',
        actions: [
          { itemId: null, itemName: 'Milk', type: 'CREATE', quantity: 3, confidence: 'HIGH' },
        ],
      }),
    );
    act(() => {
      window.dispatchEvent(new Event(RECEIPT_DRAFT_EVENT));
    });

    expect(await screen.findByDisplayValue('Milk')).toBeInTheDocument();
    expect(screen.getByText('Review scanned items')).toBeInTheDocument();
  });
});
