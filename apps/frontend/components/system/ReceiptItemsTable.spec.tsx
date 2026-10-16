import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptItemsTable } from './ReceiptItemsTable';
import type { CommittableAction } from '@/lib/ai-action-commit';

function action(overrides: Partial<CommittableAction> = {}): CommittableAction {
  return {
    itemId: 'item_1',
    itemName: 'Sugar',
    type: 'PURCHASE',
    quantity: 2,
    confidence: 'HIGH',
    ...overrides,
  };
}

describe('ReceiptItemsTable', () => {
  it('renders every scanned line as an editable row', () => {
    render(
      <ReceiptItemsTable
        actions={[
          action({ itemName: 'Sugar', quantity: 2 }),
          action({ itemName: 'Rice', quantity: 5, confidence: 'LOW' }),
        ]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Sugar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rice')).toBeInTheDocument();
    expect(screen.getByLabelText('Item 1 quantity')).toHaveValue(2);
    expect(screen.getByText(/Low confidence/)).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it('reports item and quantity edits with the row index', () => {
    const onUpdate = vi.fn();
    render(
      <ReceiptItemsTable actions={[action(), action({ itemName: 'Rice' })]} onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Item 2 name'), { target: { value: 'Basmati' } });
    expect(onUpdate).toHaveBeenCalledWith(1, { itemName: 'Basmati' });

    fireEvent.change(screen.getByLabelText('Item 2 quantity'), { target: { value: '7' } });
    expect(onUpdate).toHaveBeenCalledWith(1, { quantity: 7 });
  });

  it('removes a row and totals the extracted costs', () => {
    const onRemove = vi.fn();
    render(
      <ReceiptItemsTable
        actions={[
          action({ itemName: 'Sugar', quantity: 2, costPrice: 150 }),
          action({ itemName: 'Rice', quantity: 5, costPrice: 100 }),
        ]}
        onUpdate={vi.fn()}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove item 1'));
    expect(onRemove).toHaveBeenCalledWith(0);
    // 2 × 150 + 5 × 100 = 800
    expect(screen.getByText('KES 800')).toBeInTheDocument();
  });

  it('hides removed rows and the total when no costs were extracted', () => {
    render(
      <ReceiptItemsTable
        actions={[action({ itemName: 'Sugar' }), action({ itemName: 'Gone', _removed: true })]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByDisplayValue('Gone')).not.toBeInTheDocument();
    expect(screen.queryByText(/Estimated total/)).not.toBeInTheDocument();
  });
});
