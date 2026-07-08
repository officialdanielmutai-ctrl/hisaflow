'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddCreditSheetProps {
  onClose: () => void;
  onSave: (payload: { clientName: string; amountTotal: number; dueDate?: string; notes?: string }) => Promise<void>;
}

export default function AddCreditSheet({ onClose, onSave }: AddCreditSheetProps) {
  const [clientName, setClientName] = useState('');
  const [amountTotal, setAmountTotal] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !amountTotal) return;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        clientName: clientName.trim(),
        amountTotal: Number(amountTotal),
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save credit record.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-bg-base)] shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-xl font-bold">Log Manual Credit</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-[var(--color-bg-surface)] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="add-credit-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Client Name *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Amount Owed *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amountTotal}
                onChange={(e) => setAmountTotal(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this credit..."
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </form>
        </div>

        <div className="border-t border-[var(--color-border)] p-6 bg-[var(--color-bg-surface)]">
          <button
            type="submit"
            form="add-credit-form"
            disabled={saving || !clientName || !amountTotal}
            className="w-full rounded-2xl bg-[var(--color-accent)] py-3.5 font-bold text-white shadow-md disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving...' : 'Save Credit'}
          </button>
        </div>
      </div>
    </div>
  );
}
