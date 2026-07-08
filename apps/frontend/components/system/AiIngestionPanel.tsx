'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { parseInventoryText, type ParsedAction } from '@/services/ai-ingestion.service';
import { logTransaction } from '@/services/transactions.service';
import { createInventoryItem, updateInventoryItem } from '@/services/inventory.service';
import { createNote } from '@/services/notes.service';

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
    setError(null);
    const orgId = membership!.organization.id;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      for (const action of actions) {
        try {
          if (action.type === 'SALE' || action.type === 'PURCHASE' || action.type === 'WASTAGE') {
            // Only execute transaction actions for matched (HIGH confidence) items
            if (action.itemId) {
              await logTransaction(
                {
                  itemId: action.itemId,
                  type: action.type,
                  quantity: action.quantity,
                  note: action.type === 'WASTAGE' ? (action.wastageReason ?? 'wastage') : undefined,
                  clientName: action.clientName,
                  metadata: action.metadata,
                  isCredit: action.isCredit,
                  dueDate: action.dueDate,
                  creditNotes: action.creditNotes,
                },
                token,
                orgId,
              );
            }
          } else if (action.type === 'CREATE') {
            // Create brand-new inventory item
            await createInventoryItem(
              {
                name: action.itemName,
                unit: action.unit ?? 'pcs',
                quantity: action.quantity ?? 0,
                reorderThreshold: action.reorderThreshold ?? 5,
                category: action.category ?? undefined,
                costPrice: action.costPrice ?? undefined,
                sellingPrice: action.sellingPrice ?? undefined,
                expiryDate: action.metadata?.expiryDate ?? undefined,
                serialNumber: action.metadata?.serialNumber ?? undefined,
                batchNumber: action.metadata?.batchNumber ?? undefined,
              },
              token,
              orgId,
            );
          } else if (action.type === 'UPDATE' && action.itemId && action.updates) {
            // Update existing item fields
            await updateInventoryItem(action.itemId, action.updates, token, orgId);
          } else if (action.type === 'NOTE') {
            await createNote(token, orgId, {
              title: action.title || action.itemName,
              content: action.content,
              importance: action.importance as any,
              dueDate: action.dueDate,
              checklistItems: action.checklists,
            });
          }
        } catch (actionErr) {
          console.error(`Failed action for "${action.itemName}":`, actionErr);
          // Continue with remaining actions even if one fails
        }
      }

      setActions([]);
      setText('');
      onCompleted();
    } catch (err) {
      console.error('Confirmation failed', err);
      setError('Something went wrong. Some actions may not have been applied.');
    } finally {
      setConfirming(false);
    }
  };

  const actionLabel = (action: ParsedAction) => {
    if (action.type === 'SALE') return 'Sale';
    if (action.type === 'PURCHASE') return 'Stock In';
    if (action.type === 'WASTAGE') return 'Wastage';
    if (action.type === 'CREATE') return 'New Item';
    if (action.type === 'UPDATE') return 'Update';
    if (action.type === 'NOTE') return 'Note';
    return action.type;
  };

  const actionColor = (action: ParsedAction) => {
    if (action.type === 'SALE') return 'bg-red-100 text-red-700';
    if (action.type === 'PURCHASE') return 'bg-green-100 text-green-700';
    if (action.type === 'WASTAGE') return 'bg-orange-100 text-orange-700';
    if (action.type === 'CREATE') return 'bg-blue-100 text-blue-700';
    if (action.type === 'UPDATE') return 'bg-yellow-100 text-yellow-700';
    if (action.type === 'NOTE') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  const hasConfirmable = actions.some(
    (a) =>
      (a.type === 'SALE' && a.itemId) ||
      (a.type === 'PURCHASE' && a.itemId) ||
      (a.type === 'WASTAGE' && a.itemId) ||
      a.type === 'CREATE' ||
      a.type === 'NOTE' ||
      (a.type === 'UPDATE' && a.itemId && a.updates),
  );

  const getPlaceholder = () => {
    switch (membership?.organization.businessType) {
      case 'ISP':
        return 'e.g. "Installed 1 router for John Doe" or "Note: Team meeting tomorrow at 9am"';
      case 'CHEMIST':
        return 'e.g. "Sold 2 Panadol" or "Important: Order more Amoxil urgently"';
      default:
        return 'e.g. "sold 3 unga" or "Remind team about stock count on Friday"';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <textarea
        rows={3}
        placeholder={getPlaceholder()}
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

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {actions.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-3 text-lg font-semibold">Review Actions</h3>
          <div className="flex flex-col gap-2">
            {actions.map((action, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-4 ${
                  action.confidence === 'LOW' ? 'border-yellow-400 opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold">
                      {action.type !== 'UPDATE' && `${action.quantity}× `}
                      {action.itemName}
                    </span>
                    {action.type === 'CREATE' && (
                      <span className="text-xs text-gray-500">
                        Unit: {action.unit ?? 'pcs'} · Qty: {action.quantity ?? 0}
                        {action.sellingPrice ? ` · Price: ${action.sellingPrice}` : ''}
                      </span>
                    )}
                    {action.type === 'UPDATE' && action.updates && (
                      <span className="text-xs text-gray-500">
                        Changes: {Object.entries(action.updates).map(([k, v]) => `${k} → ${v}`).join(', ')}
                      </span>
                    )}
                    {action.isCredit && (
                      <span className="text-xs font-semibold text-blue-600">
                        💳 Taken on Credit {action.dueDate ? `(Due: ${action.dueDate})` : ''}
                      </span>
                    )}
                    {action.type === 'WASTAGE' && (
                      <span className="text-xs text-orange-600">
                        Reason: {action.wastageReason ?? 'unspecified'}
                      </span>
                    )}
                    {action.type === 'NOTE' && (
                      <span className="text-xs text-purple-600">
                        {action.importance} Priority {action.dueDate ? `· Due: ${action.dueDate}` : ''}
                      </span>
                    )}
                    {action.confidence === 'LOW' && (
                      <span className="text-xs text-yellow-600">(unmatched — will be skipped)</span>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(action)}`}>
                    {actionLabel(action)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConfirmAll}
            disabled={confirming || !hasConfirmable}
            className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white disabled:opacity-50"
          >
            {confirming ? 'Applying...' : 'Confirm All'}
          </button>
        </div>
      )}
    </div>
  );
}
