'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { logTransaction } from '@/services/transactions.service';
import type { InventoryItem } from '@/services/inventory.service';
import { PackagePlus, X } from 'lucide-react';

interface ReceiveStockSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
  onCompleted: () => void;
}

export default function ReceiveStockSheet({
  item,
  onClose,
  onCompleted,
}: ReceiveStockSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  const open = !!item;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item || !membership?.organization.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await logTransaction(
        {
          itemId: item.id,
          type: 'PURCHASE',
          quantity,
          note: note.trim() || `Stock received for ${item.name}`,
        },
        token,
        membership.organization.id,
      );
      setQuantity(1);
      setNote('');
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log stock');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setNote('');
    setError(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleClose}
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--color-bg-surface)] shadow-2xl transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-6">
          {/* Handle */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)]" />

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--color-accent)]/10 p-2">
                <PackagePlus className="h-5 w-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Receive Stock</h2>
                <p className="text-sm text-[var(--color-text-secondary)] truncate max-w-[220px]">
                  {item?.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-1.5 hover:bg-[var(--color-bg-base)] text-[var(--color-text-muted)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Current stock info */}
          {item && (
            <div className="mb-5 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] p-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Current stock</span>
              <span className="font-bold text-lg">
                {item.quantity} <span className="text-sm font-normal text-[var(--color-text-secondary)]">{item.unit}</span>
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Quantity received *
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] text-xl font-bold hover:border-[var(--color-accent)] transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-3 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-accent)] text-xl font-bold text-white hover:opacity-90 transition-opacity"
                >
                  +
                </button>
              </div>
              {item && (
                <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                  New total will be: <strong>{item.quantity + quantity} {item.unit}</strong>
                </p>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. Delivery from supplier"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-13 w-full rounded-2xl bg-[var(--color-accent)] py-3 font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Saving...' : `Receive ${quantity} ${item?.unit ?? 'units'}`}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
