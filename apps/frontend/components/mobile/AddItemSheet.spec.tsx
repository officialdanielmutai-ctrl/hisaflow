import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'token' }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({
    membership: { organization: { id: 'org_1', businessType: 'DUKA' } },
  }),
}));

vi.mock('@/hooks/useRole', () => ({
  useRole: () => ({ isStaff: false, canAddInventory: true, canEditInventory: true }),
}));

vi.mock('@/services/inventory.service', () => ({
  createInventoryItem: vi.fn(),
  lookupExternalProductByBarcode: vi.fn(),
}));

// The capture sheets open vaul portals and call camera hooks; they are not
// under test here, so keep them out of the tree.
vi.mock('@/components/system/LabelCaptureSheet', () => ({ default: () => null }));
vi.mock('@/components/system/BarcodeScannerSheet', () => ({ default: () => null }));

import AddItemSheet from './AddItemSheet';
import type { LabelOcrResult } from '@/hooks/useLabelOcrCapture';

const draft = (name: string): LabelOcrResult => ({
  name,
  category: null,
  unit: null,
  expiryDate: null,
  batchNumber: null,
});

describe('AddItemSheet (scan output form)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears stale scan data when the sheet closes so the next scan applies', () => {
    const { rerender } = render(
      <AddItemSheet
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        initialOcrDraft={draft('Sugar')}
      />,
    );
    expect(screen.getAllByDisplayValue('Sugar').length).toBeGreaterThan(0);

    // Close the sheet (the '×' path) — the form must forget the previous scan.
    rerender(<AddItemSheet open={false} onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

    // Reopen with a fresh capture: the new value must win.
    rerender(
      <AddItemSheet
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        initialOcrDraft={draft('Rice')}
      />,
    );
    expect(screen.getAllByDisplayValue('Rice').length).toBeGreaterThan(0);
    expect(screen.queryAllByDisplayValue('Sugar')).toHaveLength(0);
  });

  it('offers both Scan Barcode and Scan Label without an example name', () => {
    render(<AddItemSheet open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByText('Scan Barcode')).toBeInTheDocument();
    expect(screen.getByText('Scan Label')).toBeInTheDocument();
    expect(screen.getByText('Name *')).toBeInTheDocument();
    expect(screen.queryByText(/Margarine/i)).not.toBeInTheDocument();
  });
});
