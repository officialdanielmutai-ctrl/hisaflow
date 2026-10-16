'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import type { CommittableAction } from '@/lib/ai-action-commit';

interface ReceiptItemsTableProps {
  actions: CommittableAction[];
  onUpdate: (index: number, patch: Partial<CommittableAction>) => void;
  onRemove: (index: number) => void;
}

const TYPE_LABEL: Record<string, string> = {
  SALE: 'Sale',
  PURCHASE: 'Stock in',
  WASTAGE: 'Wastage',
  CREATE: 'New item',
  UPDATE: 'Update',
};

const inputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-60';

function formatAmount(value: number | null | undefined) {
  if (value == null) return '—';
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

/**
 * Editable line-item table for a scanned receipt/list. It is the receipt
 * counterpart of the commodity breakdown: instead of confirming one action at
 * a time, the user reviews every extracted line in a single grid, fixes names,
 * quantities and units, deletes rows that are not real, and confirms the batch.
 * The commit path is unchanged — these rows are the same actions the accordion
 * edits, just laid out as a table.
 */
export function ReceiptItemsTable({ actions, onUpdate, onRemove }: ReceiptItemsTableProps) {
  const rows = actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => !action._removed);

  const lowConfidence = rows.filter(({ action }) => action.confidence === 'LOW').length;
  const hasAmount = rows.some(
    ({ action }) => action.costPrice != null || action.sellingPrice != null,
  );
  const total = rows.reduce((sum, { action }) => {
    const unit = action.costPrice ?? action.sellingPrice;
    return unit != null ? sum + unit * (action.quantity || 0) : sum;
  }, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-base)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="w-20 px-2 py-2 font-semibold">Qty</th>
              <th className="w-24 px-2 py-2 font-semibold">Unit</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">Amount</th>
              <th className="w-24 px-2 py-2 font-semibold">Type</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ action, index }) => {
              const applied = action._status === 'applied';
              return (
                <tr
                  key={index}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      aria-label={`Item ${index + 1} name`}
                      value={action.itemName}
                      onChange={(event) => onUpdate(index, { itemName: event.target.value })}
                      disabled={applied}
                      className={inputClass}
                    />
                    {action.confidence === 'LOW' && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Low confidence — please verify
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      aria-label={`Item ${index + 1} quantity`}
                      type="number"
                      min="0"
                      step="any"
                      value={action.quantity}
                      onChange={(event) =>
                        onUpdate(index, { quantity: Number(event.target.value) })
                      }
                      disabled={applied}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      aria-label={`Item ${index + 1} unit`}
                      value={action.unit ?? ''}
                      onChange={(event) => onUpdate(index, { unit: event.target.value })}
                      disabled={applied}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2 align-top text-right text-xs font-semibold text-[var(--color-text-secondary)]">
                    {formatAmount(action.costPrice ?? action.sellingPrice)}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className="inline-block rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                      {TYPE_LABEL[action.type] ?? action.type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right align-top">
                    <button
                      type="button"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() => onRemove(index)}
                      disabled={applied}
                      className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        <span>
          {rows.length} item{rows.length === 1 ? '' : 's'}
          {lowConfidence > 0 ? ` · ${lowConfidence} to verify` : ''}
        </span>
        {hasAmount && (
          <span>
            Estimated total{' '}
            <strong className="text-[var(--color-text-primary)]">{formatAmount(total)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
