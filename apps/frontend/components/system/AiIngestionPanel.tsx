'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { parseInventoryText, captureUtterance } from '@/services/ai-ingestion.service';
import { logTransaction } from '@/services/transactions.service';
import { createInventoryItem, updateInventoryItem } from '@/services/inventory.service';
import { createNote } from '@/services/notes.service';
import { guestsService } from '@/services/guests.service';
import { roomsService } from '@/services/rooms.service';
import { Trash2, ChevronDown, ChevronUp, Camera, CheckCircle2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import {
  commitParsedActions,
  completionRoute,
  isConfirmable,
  type ActionClients,
  type CommittableAction,
} from '@/lib/ai-action-commit';

interface AiIngestionPanelProps {
  /** Navigate to the section that mirrors what the AI just applied. */
  onCompleted: (href: string) => void;
}

const CAPTURE_CONSENT_KEY = 'hisaflow:aiCaptureConsent';

// Editable local copy of a parsed action so the user can tweak before confirming.
// `_status`/`_error` come from the idempotent commit helper, so a retry never
// re-applies an action that already succeeded.
type EditableAction = CommittableAction & { _expanded?: boolean };

export default function AiIngestionPanel({ onCompleted }: AiIngestionPanelProps) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actions, setActions] = useState<EditableAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [captureConsent, setCaptureConsent] = useState(false);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  useEffect(() => {
    try {
      setCaptureConsent(window.localStorage.getItem(CAPTURE_CONSENT_KEY) === '1');
    } catch {
      // Storage unavailable (private mode) — keep consent off.
    }
  }, []);

  const updateCaptureConsent = (value: boolean) => {
    setCaptureConsent(value);
    try {
      window.localStorage.setItem(CAPTURE_CONSENT_KEY, value ? '1' : '0');
    } catch {
      // Storage unavailable — the in-memory value still applies this session.
    }
  };

  const handleParse = async () => {
    if (!membership?.organization.id || !text.trim()) return;
    setActions([]);
    setError(null);
    setParsing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await parseInventoryText(text.trim(), token, membership.organization.id);
      setActions(result.map(a => ({ ...a, _removed: false, _status: 'pending' as const, _expanded: false })));
      void captureUtterance(text.trim(), token, membership.organization.id, 'TEXT', captureConsent);
    } catch (err) {
      console.error(err);
      setError('Could not parse. Try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !membership?.organization.id) return;
    
    setActions([]);
    setError(null);
    setParsing(true);
    
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // 1. Compress image client-side
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 3,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
      });

      // 2. Upload to OCR endpoint
      const formData = new FormData();
      formData.append('image', compressedFile);

      const ocrRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ocr/receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': membership.organization.id,
        },
        body: formData,
      });

      if (!ocrRes.ok) {
        let errMsg = 'Failed to process receipt image';
        try {
          const errBody = await ocrRes.json();
          errMsg = errBody?.message || errMsg;
        } catch {
          /* keep the default message */
        }
        throw new Error(errMsg);
      }

      const { text: extractedText } = await ocrRes.json();
      
      if (!extractedText.trim()) {
        throw new Error('No text detected in this image. Try better lighting, hold the camera steady, and make sure the receipt fills the frame.');
      }

      // 3. Feed extracted text (with confidence flags) to AI
      setText(extractedText);
      const result = await parseInventoryText(extractedText, token, membership.organization.id, 'RECEIPT_OCR');
      setActions(result.map(a => ({ ...a, _removed: false, _status: 'pending' as const, _expanded: false })));
      void captureUtterance(extractedText, token, membership.organization.id, 'RECEIPT_OCR', captureConsent);

    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Could not process receipt. Try again.');
    } finally {
      setParsing(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const updateAction = (index: number, patch: Partial<EditableAction>) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, ...patch } : a));
  };

  const removeAction = (index: number) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, _removed: true } : a));
  };

  const handleConfirmAll = async () => {
    if (!membership?.organization.id) return;
    setConfirming(true);
    setError(null);
    const orgId = membership.organization.id;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const clients: ActionClients = {
        logTransaction: async (a) => {
          if (!a.itemId) throw new Error('No matching inventory item found.');
          if (a.type !== 'SALE' && a.type !== 'PURCHASE' && a.type !== 'WASTAGE') {
            throw new Error('Not a stock transaction.');
          }
          await logTransaction(
            {
              itemId: a.itemId,
              type: a.type,
              quantity: a.quantity,
              note: a.type === 'WASTAGE' ? (a.wastageReason ?? 'wastage') : undefined,
              clientName: a.clientName,
              metadata: a.metadata,
              isCredit: a.isCredit,
              dueDate: a.dueDate,
              creditNotes: a.creditNotes,
            },
            token,
            orgId,
          );
        },
        createInventoryItem: (a) =>
          createInventoryItem(
            {
              name: a.itemName,
              unit: a.unit ?? 'pcs',
              quantity: a.quantity ?? 0,
              reorderThreshold: a.reorderThreshold ?? 5,
              category: a.category ?? undefined,
              costPrice: a.costPrice ?? undefined,
              sellingPrice: a.sellingPrice ?? undefined,
            },
            token,
            orgId,
          ),
        updateInventoryItem: async (a) => {
          if (!a.itemId || !a.updates) throw new Error('Nothing to update.');
          await updateInventoryItem(a.itemId, a.updates, token, orgId);
        },
        createNote: (a) =>
          createNote(token, orgId, {
            title: a.title || a.itemName,
            content: a.content,
            importance: a.importance,
            dueDate: a.dueDate,
            checklistItems: a.checklists,
          }),
        createGuest: (a) =>
          guestsService.create(
            {
              name: a.guestName || a.itemName,
              phone: a.phone,
              email: a.email,
              idNumber: a.idNumber,
            },
            token,
            orgId,
          ),
        createRoom: (a) =>
          roomsService.create(
            {
              name: a.roomName || a.itemName,
              type: a.roomType || 'Standard',
              baseRate: a.baseRate || 0,
            },
            token,
            orgId,
          ),
      };

      const { outcomes, booking } = await commitParsedActions(actions, clients);

      const updated = actions.map((a, i) => {
        const outcome = outcomes.find((o) => o.index === i);
        if (!outcome) return a;
        if (outcome.status === 'applied') {
          return { ...a, _status: 'applied' as const, _error: undefined };
        }
        if (outcome.status === 'failed') {
          return { ...a, _status: 'failed' as const, _error: outcome.error };
        }
        return a;
      });

      const failed = outcomes.filter((o) => o.status === 'failed');
      if (failed.length > 0) {
        setActions(updated);
        setError(
          `${failed.length} action${failed.length > 1 ? 's' : ''} could not be applied. ` +
            'Only the failed actions will be retried; applied ones will not be sent again.',
        );
      } else {
        const applied = updated.filter((a) => a._status === 'applied');
        setActions([]);
        setText('');
        if (booking) {
          const params = new URLSearchParams();
          if (booking.guestName) params.set('guestName', booking.guestName);
          if (booking.roomName) params.set('roomName', booking.roomName);
          if (booking.checkInDate) params.set('checkIn', booking.checkInDate);
          if (booking.checkOutDate) params.set('checkOut', booking.checkOutDate);
          onCompleted(`/bookings/new?${params.toString()}`);
        } else {
          onCompleted(completionRoute(applied));
        }
      }
    } catch (err) {
      console.error('Confirmation failed', err);
      setError('Something went wrong. No further actions were submitted.');
    } finally {
      setConfirming(false);
    }
  };

  const actionLabel = (action: EditableAction) => {
    const typeMap: Record<string, string> = {
      SALE: 'Sale', PURCHASE: 'Stock In', WASTAGE: 'Wastage',
      CREATE: 'New Item', UPDATE: 'Update', NOTE: 'Note',
      BOOKING: 'Booking', GUEST: 'New Guest', ROOM: 'New Room',
    };
    return typeMap[action.type] ?? action.type;
  };

  const actionColor = (action: EditableAction) => {
    const colorMap: Record<string, string> = {
      SALE: 'bg-red-100 text-red-700',
      PURCHASE: 'bg-green-100 text-green-700',
      WASTAGE: 'bg-orange-100 text-orange-700',
      CREATE: 'bg-blue-100 text-blue-700',
      UPDATE: 'bg-yellow-100 text-yellow-700',
      NOTE: 'bg-purple-100 text-purple-700',
      BOOKING: 'bg-indigo-100 text-indigo-700',
      GUEST: 'bg-teal-100 text-teal-700',
      ROOM: 'bg-sky-100 text-sky-700',
    };
    return colorMap[action.type] ?? 'bg-gray-100 text-gray-700';
  };

  const hasConfirmable = actions.some(isConfirmable);
  const remainingCount = actions.filter(isConfirmable).length;
  const appliedCount = actions.filter((a) => a._status === 'applied').length;

  const getPlaceholder = () => {
    switch (membership?.organization.businessType) {
      case 'GUEST_HOUSE':
      case 'HOTEL':
      case 'LODGE':
        return 'e.g. "John checked into Room 5 for 2 nights" or "Add guest Mary Wanjiru, 0712345678" or "Add Room 7, Deluxe, 3500/night"';
      case 'ISP':
        return 'e.g. "Installed 1 router for John Doe" or "Note: Team meeting tomorrow at 9am"';
      case 'CHEMIST':
        return 'e.g. "Sold 2 Panadol" or "Important: Order more Amoxil urgently"';
      default:
        return 'e.g. "sold 3 unga" or "Remind team about stock count on Friday"';
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none',
    background: '#FAFAFA',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
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
      <label className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          checked={captureConsent}
          onChange={(e) => updateCaptureConsent(e.target.checked)}
        />
        <span>
          Help improve the assistant: save an anonymised copy of this text
          (emails, phone numbers and ID numbers are removed). Off by default.
        </span>
      </label>
      <div className="flex gap-2">
        <button
          onClick={handleParse}
          disabled={parsing || !text.trim()}
          className="h-12 flex-1 rounded-2xl bg-[var(--color-accent)] font-semibold text-white disabled:opacity-50"
        >
          {parsing ? 'Parsing...' : 'Parse with AI'}
        </button>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={handleImageUpload}
            disabled={parsing}
          />
          <button
            type="button"
            disabled={parsing}
            className="h-12 px-4 rounded-2xl border-2 border-[var(--color-accent)] font-semibold text-[var(--color-accent)] flex items-center justify-center disabled:opacity-50 hover:bg-[var(--color-accent)] hover:text-white transition-colors"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {actions.length > 0 && (
        <div className="mt-2">
          <h3 className="mb-1 text-base font-semibold">Review & Edit Actions</h3>
          <p className="text-xs text-gray-500 mb-3">Tap any action to expand and edit its fields before confirming.</p>

          <div className="flex flex-col gap-3">
            {actions.map((action, i) => {
              if (action._removed) return null;
              const isExpanded = action._expanded;
              const isApplied = action._status === 'applied';

              return (
                <div
                  key={i}
                  style={{
                    border: '1px solid',
                    borderColor: action._status === 'failed' ? '#fca5a5' : action.confidence === 'LOW' ? '#fbbf24' : '#e5e7eb',
                    borderRadius: 16, overflow: 'hidden',
                    opacity: isApplied || action.confidence === 'LOW' ? 0.7 : 1,
                  }}
                >
                  {/* Summary row — always visible */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: isApplied ? 'default' : 'pointer', background: '#fafafa' }}
                    onClick={() => { if (!isApplied) updateAction(i, { _expanded: !isExpanded }); }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {action.type === 'BOOKING'
                          ? `${action.guestName ?? '?'} → ${action.roomName ?? '?'}`
                          : action.type === 'GUEST'
                          ? action.guestName || action.itemName
                          : action.type === 'ROOM'
                          ? action.roomName || action.itemName
                          : action.type === 'UPDATE' ? action.itemName
                          : `${action.quantity}× ${action.itemName}`
                        }
                      </span>
                      {action.confidence === 'LOW' && (
                        <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>⚠ Low confidence scan — please verify carefully</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isApplied ? (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 size={12} /> Applied
                        </span>
                      ) : (
                        <>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(action)}`}>
                            {actionLabel(action)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeAction(i); }}
                            style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                          >
                            <Trash2 size={14} />
                          </button>
                          {isExpanded ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
                        </>
                      )}
                    </div>
                  </div>

                  {action._error && (
                    <p style={{ margin: 0, padding: '8px 14px', background: '#fef2f2', color: '#b91c1c', fontSize: 12, borderTop: '1px solid #fee2e2' }}>
                      Could not apply: {action._error}
                    </p>
                  )}

                  {/* Editable fields — shown when expanded */}
                  {isExpanded && (
                    <div style={{ padding: '14px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFAFA' }}>

                      {/* SALE / PURCHASE / WASTAGE */}
                      {(action.type === 'SALE' || action.type === 'PURCHASE' || action.type === 'WASTAGE') && (
                        <>
                          <div>
                            <label style={labelStyle}>Item Name</label>
                            <input style={inputStyle} value={action.itemName} onChange={e => updateAction(i, { itemName: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Quantity</label>
                            <input style={inputStyle} type="number" min="0" step="any" value={action.quantity} onChange={e => updateAction(i, { quantity: Number(e.target.value) })} />
                          </div>
                          {action.type === 'WASTAGE' && (
                            <div>
                              <label style={labelStyle}>Wastage Reason</label>
                              <select style={inputStyle} value={action.wastageReason ?? ''} onChange={e => updateAction(i, { wastageReason: e.target.value })}>
                                {['expired', 'damaged', 'stolen', 'spoiled', 'broken', 'contaminated', 'lost', 'other'].map(r => (
                                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}

                      {/* BOOKING */}
                      {action.type === 'BOOKING' && (
                        <>
                          <div>
                            <label style={labelStyle}>Guest Name</label>
                            <input style={inputStyle} value={action.guestName ?? ''} onChange={e => updateAction(i, { guestName: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Room Name</label>
                            <input style={inputStyle} value={action.roomName ?? ''} onChange={e => updateAction(i, { roomName: e.target.value })} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <label style={labelStyle}>Check-in Date</label>
                              <input style={inputStyle} type="date" value={action.checkInDate?.split('T')[0] ?? ''} onChange={e => updateAction(i, { checkInDate: e.target.value })} />
                            </div>
                            <div>
                              <label style={labelStyle}>Check-out Date</label>
                              <input style={inputStyle} type="date" value={action.checkOutDate?.split('T')[0] ?? ''} onChange={e => updateAction(i, { checkOutDate: e.target.value })} />
                            </div>
                          </div>
                        </>
                      )}

                      {/* GUEST */}
                      {action.type === 'GUEST' && (
                        <>
                          <div>
                            <label style={labelStyle}>Full Name</label>
                            <input style={inputStyle} value={action.guestName ?? action.itemName} onChange={e => updateAction(i, { guestName: e.target.value, itemName: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Phone (Optional)</label>
                            <input style={inputStyle} type="tel" value={action.phone ?? ''} onChange={e => updateAction(i, { phone: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Email (Optional)</label>
                            <input style={inputStyle} type="email" value={action.email ?? ''} onChange={e => updateAction(i, { email: e.target.value })} />
                          </div>
                        </>
                      )}

                      {/* ROOM */}
                      {action.type === 'ROOM' && (
                        <>
                          <div>
                            <label style={labelStyle}>Room Name or Number</label>
                            <input style={inputStyle} value={action.roomName ?? action.itemName} onChange={e => updateAction(i, { roomName: e.target.value, itemName: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Room Type</label>
                            <select style={inputStyle} value={action.roomType ?? 'Standard'} onChange={e => updateAction(i, { roomType: e.target.value })}>
                              {['Single', 'Double', 'Standard', 'Suite', 'Deluxe'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Base Rate Per Night</label>
                            <input style={inputStyle} type="number" min="0" step="any" value={action.baseRate ?? ''} onChange={e => updateAction(i, { baseRate: Number(e.target.value) })} />
                          </div>
                        </>
                      )}

                      {/* CREATE */}
                      {action.type === 'CREATE' && (
                        <>
                          <div>
                            <label style={labelStyle}>Item Name</label>
                            <input style={inputStyle} value={action.itemName} onChange={e => updateAction(i, { itemName: e.target.value })} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <label style={labelStyle}>Unit</label>
                              <input style={inputStyle} value={action.unit ?? 'pcs'} onChange={e => updateAction(i, { unit: e.target.value })} />
                            </div>
                            <div>
                              <label style={labelStyle}>Opening Qty</label>
                              <input style={inputStyle} type="number" min="0" value={action.quantity ?? 0} onChange={e => updateAction(i, { quantity: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label style={labelStyle}>Cost Price</label>
                              <input style={inputStyle} type="number" min="0" step="any" value={action.costPrice ?? ''} onChange={e => updateAction(i, { costPrice: Number(e.target.value) })} />
                            </div>
                            <div>
                              <label style={labelStyle}>Selling Price</label>
                              <input style={inputStyle} type="number" min="0" step="any" value={action.sellingPrice ?? ''} onChange={e => updateAction(i, { sellingPrice: Number(e.target.value) })} />
                            </div>
                          </div>
                        </>
                      )}

                      {/* NOTE */}
                      {action.type === 'NOTE' && (
                        <>
                          <div>
                            <label style={labelStyle}>Title</label>
                            <input style={inputStyle} value={action.title ?? ''} onChange={e => updateAction(i, { title: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Content</label>
                            <textarea style={{ ...inputStyle, resize: 'none' }} rows={3} value={action.content ?? ''} onChange={e => updateAction(i, { content: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Priority</label>
                            <select style={inputStyle} value={action.importance ?? 'MEDIUM'} onChange={e => updateAction(i, { importance: e.target.value as CommittableAction['importance'] })}>
                              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleConfirmAll}
            disabled={confirming || !hasConfirmable}
            className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-accent)] font-semibold text-white disabled:opacity-50"
          >
            {confirming
              ? 'Applying...'
              : appliedCount > 0 && remainingCount > 0
                ? `Retry remaining (${remainingCount})`
                : 'Confirm & Apply'}
          </button>
        </div>
      )}
    </div>
  );
}
