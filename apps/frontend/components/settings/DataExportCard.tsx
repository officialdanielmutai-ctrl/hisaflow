'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Download, Loader2 } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  downloadOwnerExport,
  type ExportDataset,
} from '@/lib/data-export';

const DATASETS: { id: ExportDataset; label: string; description: string }[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Every item, stock level, cost and price.',
  },
  {
    id: 'transactions',
    label: 'Sales & stock ledger',
    description: 'Every sale, purchase, wastage and correction.',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    description: 'Guest house and subscriber invoices with tax and balances.',
  },
  {
    id: 'fee-invoices',
    label: 'School fee invoices',
    description: 'Fee invoices per student and term, with paid balances.',
  },
  {
    id: 'credit',
    label: 'Customer credit',
    description: 'Who owes you, how much and how old each debt is.',
  },
  {
    id: 'tax',
    label: 'Tax records',
    description: 'eTIMS records, tax amounts and KRA confirmation state.',
  },
];

export function DataExportCard() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [busy, setBusy] = useState<ExportDataset | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const orgId = membership?.organization.id;

  const handleExport = async (dataset: ExportDataset) => {
    if (!orgId) return;
    setBusy(dataset);
    setMessage('');
    setIsError(false);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await downloadOwnerExport(dataset, token, orgId);
      setMessage('Download ready.');
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not export this data.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {DATASETS.map((dataset) => (
        <div
          key={dataset.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {dataset.label}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {dataset.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleExport(dataset.id)}
            disabled={busy !== null}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
          >
            {busy === dataset.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            CSV
          </button>
        </div>
      ))}

      {message && (
        <p
          className={`px-4 py-3 text-xs ${
            isError ? 'text-red-500' : 'text-emerald-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
