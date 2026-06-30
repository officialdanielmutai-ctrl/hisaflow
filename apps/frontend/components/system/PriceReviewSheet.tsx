'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import type { PriceSuggestion } from '@/services/finance.service';
import { confirmItemPrice } from '@/services/finance.service';
import { CheckCircle, Edit2, X } from 'lucide-react';

interface PriceReviewSheetProps {
  suggestions: PriceSuggestion[];
  onClose: () => void;
  onConfirmed: () => void;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-gray-100 text-gray-600',
};

export default function PriceReviewSheet({
  suggestions,
  onClose,
  onConfirmed,
}: PriceReviewSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  // Local editable state: keyed by itemId
  const [edits, setEdits] = useState<
    Record<string, { costPrice: string; sellingPrice: string }>
  >(
    Object.fromEntries(
      suggestions.map((s) => [
        s.itemId,
        {
          costPrice: String(s.currentCostPrice ?? s.suggestedCostPrice ?? ''),
          sellingPrice: String(s.currentSellingPrice ?? s.suggestedSellingPrice ?? ''),
        },
      ]),
    ),
  );

  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleField = (itemId: string, field: 'costPrice' | 'sellingPrice', value: string) => {
    setEdits((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleConfirmAll = async () => {
    const orgId = membership?.organization.id;
    if (!orgId) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      for (const s of suggestions) {
        const edit = edits[s.itemId];
        const cost = parseFloat(edit.costPrice);
        const sell = parseFloat(edit.sellingPrice);
        if (!isNaN(cost) && !isNaN(sell) && cost > 0 && sell >= cost) {
          await confirmItemPrice(s.itemId, cost, sell, token, orgId);
          setConfirmed((prev) => new Set([...prev, s.itemId]));
        }
      }
      onConfirmed();
    } catch (e) {
      setError('Some prices could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0">
      <div className="w-full max-w-lg rounded-t-3xl bg-[var(--color-bg-surface)] shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Review Prices</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              AI has suggested prices — confirm or adjust before saving.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-bg-base)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {suggestions.map((s) => {
            const isConfirmed = confirmed.has(s.itemId);
            return (
              <div
                key={s.itemId}
                className={`rounded-2xl border p-4 transition-all ${isConfirmed ? 'border-green-400 bg-green-50 opacity-70' : 'border-[var(--color-border)]'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{s.unit}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_COLOR[s.confidence]}`}>
                    {s.confidence} confidence
                  </span>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] mb-3 italic">
                  {s.note}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                      Cost Price (KES)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={edits[s.itemId]?.costPrice ?? ''}
                      onChange={(e) => handleField(s.itemId, 'costPrice', e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-base)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      disabled={isConfirmed}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                      Selling Price (KES)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={edits[s.itemId]?.sellingPrice ?? ''}
                      onChange={(e) => handleField(s.itemId, 'sellingPrice', e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm bg-[var(--color-bg-base)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      disabled={isConfirmed}
                    />
                  </div>
                </div>

                {(() => {
                  const cost = parseFloat(edits[s.itemId]?.costPrice ?? '');
                  const sell = parseFloat(edits[s.itemId]?.sellingPrice ?? '');
                  if (!isNaN(cost) && !isNaN(sell) && sell > cost) {
                    const margin = ((sell - cost) / sell) * 100;
                    return (
                      <p className="mt-2 text-xs text-green-600 font-medium">
                        Margin: {margin.toFixed(1)}% · Profit: KES {(sell - cost).toFixed(2)} per {s.unit}
                      </p>
                    );
                  }
                  if (!isNaN(cost) && !isNaN(sell) && sell <= cost) {
                    return (
                      <p className="mt-2 text-xs text-red-500 font-medium">
                        ⚠ Selling price must be higher than cost price
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-5 py-4 flex flex-col gap-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleConfirmAll}
            disabled={saving}
            className="h-12 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Confirm & Save All Prices`}
          </button>
        </div>
      </div>
    </div>
  );
}
