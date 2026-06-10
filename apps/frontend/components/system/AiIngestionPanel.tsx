'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { parseInventoryText, type ParsedAction } from '@/services/ai-ingestion.service';
import { logTransaction } from '@/services/transactions.service';

interface AiIngestionPanelProps {
  onCompleted: () => void;
}

export default function AiIngestionPanel({ onCompleted }: AiIngestionPanelProps) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actions, setActions] = useState<ParsedAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  const handleParse = async () => {
    if (!membership?.organization.id || !text.trim()) return;
    setActions([]);
    setError(null);
    setParsing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await parseInventoryText(text.trim(), token, membership!.organization.id);
      setActions(result);
    } catch (err) {
      console.error(err);
      setError('Could not parse. Try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmAll = async () => {
    if (!membership?.organization.id) return;
    setConfirming(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const actionable = actions.filter((a) => a.itemId !== null);
      for (const action of actionable) {
        await logTransaction(
          {
            itemId: action.itemId!,
            type: action.type,
            quantity: action.quantity,
          },
          token,
          membership!.organization.id,
        );
      }
      setActions([]);
      setText('');
      onCompleted();
    } catch (err) {
      console.error('Confirmation failed', err);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <textarea
        rows={3}
        placeholder='e.g. "sold 3 unga and 2 cooking oil"'
        className="w-full rounded-2xl border p-4 text-base resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={handleParse}
        disabled={parsing || !text.trim()}
        className="h-12 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white"
      >
        {parsing ? 'Parsing...' : 'Parse with AI'}
      </button>

      {error && <p className="text-red-500">{error}</p>}

      {actions.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-3 text-lg font-semibold">Review</h3>
          <div className="flex flex-col gap-2">
            {actions.map((action, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-4 ${
                  action.itemId === null ? 'border-yellow-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-semibold">
                      {action.quantity}× {action.itemName}
                    </span>
                    {action.confidence === 'LOW' && (
                      <span className="ml-2 text-xs text-yellow-600">
                        (unmatched)
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      action.type === 'SALE'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {action.type === 'SALE' ? 'Sale' : 'Stock In'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirmAll}
            disabled={
              confirming ||
              !actions.some((a) => a.itemId !== null)
            }
            className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white"
          >
            {confirming ? 'Confirming...' : 'Confirm All'}
          </button>
        </div>
      )}
    </div>
  );
}
