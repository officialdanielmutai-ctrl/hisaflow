'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useInventory } from '@/hooks/useInventory';
import {
  logTransaction,
  type TransactionType,
} from '@/services/transactions.service';

interface QuickTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function QuickTransactionSheet({
  open,
  onOpenChange,
  onSuccess,
}: QuickTransactionSheetProps) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [type, setType] = useState<TransactionType>('SALE');
  const [quantity, setQuantity] = useState(1);
  const [selectedPackIndex, setSelectedPackIndex] = useState(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { items: products } = useInventory();

  // Flatten all variants for the selector
  const flatItems = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      name: `${p.name} — ${v.name}`,
      quantity: v.quantity,
      unit: v.unit,
      packaging: v.packaging || [],
    }))
  );

  const selectedItem = flatItems.find((i) => i.id === selectedItemId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership?.organization.id || !selectedItemId) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      let multiplier = 1;
      if (selectedItem && selectedPackIndex > 0) {
        const pack = selectedItem.packaging[selectedPackIndex - 1];
        if (pack) multiplier = pack.quantityPerUnit;
      }
      const absoluteQuantity = quantity * multiplier;

      await logTransaction(
        {
          itemId: selectedItemId,
          type,
          quantity: absoluteQuantity,
          note: note || undefined,
        },
        token,
        membership!.organization.id,
      );
      onSuccess();
      onOpenChange(false);
      setSelectedItemId('');
      setNote('');
      setQuantity(1);
      setSelectedPackIndex(0);
    } catch (error) {
      console.error('Transaction failed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => onOpenChange(false)}
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--color-bg-surface)] p-6 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="mb-6 text-xl font-bold">Log Transaction</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type toggle */}
          <div className="mb-4 flex gap-3">
            <button
              type="button"
              onClick={() => setType('SALE')}
              className={`h-14 flex-1 rounded-2xl font-semibold text-base ${
                type === 'SALE'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-muted text-[var(--color-text-primary)]'
              }`}
            >
              Sale
            </button>
            <button
              type="button"
              onClick={() => setType('PURCHASE')}
              className={`h-14 flex-1 rounded-2xl font-semibold text-base ${
                type === 'PURCHASE'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-muted text-[var(--color-text-primary)]'
              }`}
            >
              Stock In
            </button>
          </div>

          {/* Item selector */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Item</label>
            <select
              className="w-full rounded-xl border px-3 py-2 bg-transparent"
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setSelectedPackIndex(0);
              }}
              required
            >
              <option value="" disabled>
                Select item
              </option>
              {flatItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">
              Quantity *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border px-3 py-2 bg-transparent"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
              <select
                className="rounded-xl border px-3 py-2 bg-[var(--color-bg-base)] text-sm w-32"
                value={selectedPackIndex}
                onChange={(e) => setSelectedPackIndex(Number(e.target.value))}
                disabled={!selectedItem}
              >
                {selectedItem ? (
                  <>
                    <option value={0}>{selectedItem.unit ? selectedItem.unit + 's' : 'Units'}</option>
                    {selectedItem.packaging.map((p: any, i: number) => (
                      <option key={i} value={i + 1}>{p.name ? p.name + 's' : `Pack ${i+1}`}</option>
                    ))}
                  </>
                ) : (
                  <option value={0}>Units</option>
                )}
              </select>
            </div>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Note</label>
            <input
              type="text"
              placeholder="Note (optional)"
              className="w-full rounded-xl border px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white"
          >
            {loading ? 'Saving...' : 'Log Transaction'}
          </button>
        </form>
      </div>
    </>
  );
}
