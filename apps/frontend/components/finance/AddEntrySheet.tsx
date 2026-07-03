'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type CreateBusinessTransactionPayload,
} from '@/services/business-finance.service';

interface Props {
  onClose: () => void;
  onSave: (payload: CreateBusinessTransactionPayload) => Promise<void>;
}

export default function AddEntrySheet({ onClose, onSave }: Props) {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'MONTHLY' | 'WEEKLY' | 'YEARLY'>('MONTHLY');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSave = async () => {
    if (!category) { setError('Please select a category.'); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError('Please enter a valid amount.'); return; }

    setSaving(true);
    setError('');
    try {
      await onSave({
        type,
        category,
        amount: amt,
        description: description.trim() || undefined,
        staffName: category === 'SALARY' && staffName.trim() ? staffName.trim() : undefined,
        date,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : undefined,
      });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg mx-auto rounded-t-3xl bg-[var(--color-bg-surface)] border-t border-x border-[var(--color-border)] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        <div className="px-5 pt-2 pb-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Log Entry</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--color-bg-base)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Income / Expense toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--color-bg-base)]">
            {(['EXPENSE', 'INCOME'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setCategory(''); }}
                className={`rounded-xl py-2 text-sm font-semibold transition-all ${
                  type === t
                    ? t === 'EXPENSE'
                      ? 'bg-red-500 text-white shadow'
                      : 'bg-emerald-500 text-white shadow'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {t === 'EXPENSE' ? '↑ Expense' : '↓ Income'}
              </button>
            ))}
          </div>

          {/* Category grid */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-all border ${
                    category === cat.value
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                  }`}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-[10px] leading-tight font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Staff name — only for SALARY */}
          {category === 'SALARY' && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1 block">
                Staff Name
              </label>
              <input
                type="text"
                placeholder="e.g. John Kamau"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1 block">
              Amount (KES)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)]">
                KES
              </span>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1 block">
              Note <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder={`e.g. ${type === 'EXPENSE' ? 'July rent payment' : 'Catering service fee'}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
            <div>
              <p className="text-sm font-medium">Recurring</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Repeats automatically</p>
            </div>
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isRecurring ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Recurrence rule */}
          {isRecurring && (
            <div className="relative">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1 block">Frequency</label>
              <select
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value as any)}
                className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <ChevronDown className="absolute right-3 top-8 h-4 w-4 text-[var(--color-text-muted)] pointer-events-none" />
            </div>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-2xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: type === 'EXPENSE' ? '#ef4444' : 'var(--color-accent)' }}
          >
            {saving ? 'Saving…' : `Log ${type === 'EXPENSE' ? 'Expense' : 'Income'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
