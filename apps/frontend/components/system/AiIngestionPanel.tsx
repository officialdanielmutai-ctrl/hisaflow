'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { parseInventoryText, type ParsedAction } from '@/services/ai-ingestion.service';
import { logTransaction } from '@/services/transactions.service';
import { createInventoryItem, updateInventoryItem } from '@/services/inventory.service';
import { createNote } from '@/services/notes.service';
import { guestsService } from '@/services/guests.service';
import { roomsService } from '@/services/rooms.service';
import { useRouter } from 'next/navigation';
import { Trash2, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface AiIngestionPanelProps {
  onCompleted: () => void;
}

// Editable local copy of a parsed action so the user can tweak before confirming
type EditableAction = ParsedAction & { _removed?: boolean; _expanded?: boolean };

export default function AiIngestionPanel({ onCompleted }: AiIngestionPanelProps) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actions, setActions] = useState<EditableAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const router = useRouter();

  const handleParse = async () => {
    if (!membership?.organization.id || !text.trim()) return;
    setActions([]);
    setError(null);
    setParsing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await parseInventoryText(text.trim(), token, membership!.organization.id);
      setActions(result.map(a => ({ ...a, _removed: false, _expanded: false })));
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
        } catch {}
        throw new Error(errMsg);
      }

      const { text: extractedText } = await ocrRes.json();
      
      if (!extractedText.trim()) {
        throw new Error('No text detected in this image. Try better lighting, hold the camera steady, and make sure the receipt fills the frame.');
      }

      // 3. Feed extracted text (with confidence flags) to AI
      setText(extractedText);
      const result = await parseInventoryText(extractedText, token, membership.organization.id, 'RECEIPT_OCR');
      setActions(result.map(a => ({ ...a, _removed: false, _expanded: false })));

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not process receipt. Try again.');
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
    const orgId = membership!.organization.id;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const activeActions = actions.filter(a => !a._removed);
      let bookingAction: EditableAction | undefined;

      for (const action of activeActions) {
        try {
          if (action.type === 'SALE' || action.type === 'PURCHASE' || action.type === 'WASTAGE') {
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
            await createInventoryItem(
              {
                name: action.itemName,
                unit: action.unit ?? 'pcs',
                quantity: action.quantity ?? 0,
                reorderThreshold: action.reorderThreshold ?? 5,
                category: action.category ?? undefined,
                costPrice: action.costPrice ?? undefined,
                sellingPrice: action.sellingPrice ?? undefined,
              },
              token,
              orgId,
            );
          } else if (action.type === 'UPDATE' && action.itemId && action.updates) {
            await updateInventoryItem(action.itemId, action.updates, token, orgId);
          } else if (action.type === 'NOTE') {
            await createNote(token, orgId, {
              title: action.title || action.itemName,
              content: action.content,
              importance: action.importance as any,
              dueDate: action.dueDate,
              checklistItems: action.checklists,
            });
          } else if ((action.type as string) === 'GUEST') {
            await guestsService.create(
              {
                name: action.guestName || action.itemName,
                phone: (action as any).phone || undefined,
                email: (action as any).email || undefined,
                idNumber: (action as any).idNumber || undefined,
              },
              token,
              orgId,
            );
          } else if ((action.type as string) === 'ROOM') {
            await roomsService.create(
              {
                name: action.roomName || action.itemName,
                type: (action as any).roomType || 'Standard',
                baseRate: (action as any).baseRate || 0,
                notes: (action as any).notes || undefined,
              },
              token,
              orgId,
            );
          } else if (action.type === 'BOOKING') {
            bookingAction = action;
          }
        } catch (actionErr) {
          console.error(`Failed action for "${action.itemName}":`, actionErr);
        }
      }

      setActions([]);
      setText('');
      onCompleted();

      if (bookingAction) {
        const params = new URLSearchParams();
        if (bookingAction.guestName) params.set('guestName', bookingAction.guestName);
        if (bookingAction.roomName) params.set('roomName', bookingAction.roomName);
        if (bookingAction.checkInDate) params.set('checkIn', bookingAction.checkInDate);
        if (bookingAction.checkOutDate) params.set('checkOut', bookingAction.checkOutDate);
        router.push(`/bookings/new?${params.toString()}`);
      }
    } catch (err) {
      console.error('Confirmation failed', err);
      setError('Something went wrong. Some actions may not have been applied.');
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

  const hasConfirmable = actions.some(a => !a._removed && (
    (a.type === 'SALE' && a.itemId) ||
    (a.type === 'PURCHASE' && a.itemId) ||
    (a.type === 'WASTAGE' && a.itemId) ||
    a.type === 'CREATE' ||
    a.type === 'NOTE' ||
    a.type === 'BOOKING' ||
    (a.type as string) === 'GUEST' ||
    (a.type as string) === 'ROOM' ||
    (a.type === 'UPDATE' && a.itemId && a.updates)
  ));

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
    background: '#fff',
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

              return (
                <div
                  key={i}
                  style={{
                    border: '1px solid',
                    borderColor: action.confidence === 'LOW' ? '#fbbf24' : '#e5e7eb',
                    borderRadius: 16, overflow: 'hidden',
                    opacity: action.confidence === 'LOW' ? 0.7 : 1,
                  }}
                >
                  {/* Summary row — always visible */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', background: '#fafafa' }}
                    onClick={() => updateAction(i, { _expanded: !isExpanded })}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {action.type === 'BOOKING'
                          ? `${action.guestName ?? '?'} → ${action.roomName ?? '?'}`
                          : action.type === 'GUEST'
                          ? (action as any).guestName || action.itemName
                          : action.type === 'ROOM'
                          ? (action as any).roomName || action.itemName
                          : action.type === 'UPDATE' ? action.itemName
                          : `${action.quantity}× ${action.itemName}`
                        }
                      </span>
                      {action.confidence === 'LOW' && (
                        <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>⚠ Low confidence scan — please verify carefully</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    </div>
                  </div>

                  {/* Editable fields — shown when expanded */}
                  {isExpanded && (
                    <div style={{ padding: '14px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 10, background: '#fff' }}>

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
                      {(action.type as string) === 'GUEST' && (
                        <>
                          <div>
                            <label style={labelStyle}>Full Name</label>
                            <input style={inputStyle} value={(action as any).guestName ?? action.itemName} onChange={e => updateAction(i, { guestName: e.target.value, itemName: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Phone (Optional)</label>
                            <input style={inputStyle} type="tel" value={(action as any).phone ?? ''} onChange={e => updateAction(i, { ...(action as any), phone: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Email (Optional)</label>
                            <input style={inputStyle} type="email" value={(action as any).email ?? ''} onChange={e => updateAction(i, { ...(action as any), email: e.target.value })} />
                          </div>
                        </>
                      )}

                      {/* ROOM */}
                      {(action.type as string) === 'ROOM' && (
                        <>
                          <div>
                            <label style={labelStyle}>Room Name or Number</label>
                            <input style={inputStyle} value={(action as any).roomName ?? action.itemName} onChange={e => updateAction(i, { roomName: e.target.value, itemName: e.target.value })} />
                          </div>
                          <div>
                            <label style={labelStyle}>Room Type</label>
                            <select style={inputStyle} value={(action as any).roomType ?? 'Standard'} onChange={e => updateAction(i, { ...(action as any), roomType: e.target.value })}>
                              {['Single', 'Double', 'Standard', 'Suite', 'Deluxe'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Base Rate Per Night</label>
                            <input style={inputStyle} type="number" min="0" step="any" value={(action as any).baseRate ?? ''} onChange={e => updateAction(i, { ...(action as any), baseRate: Number(e.target.value) })} />
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
                            <select style={inputStyle} value={action.importance ?? 'MEDIUM'} onChange={e => updateAction(i, { importance: e.target.value as any })}>
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
            {confirming ? 'Applying...' : 'Confirm & Apply'}
          </button>
        </div>
      )}
    </div>
  );
}
