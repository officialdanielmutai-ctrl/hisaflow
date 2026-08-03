'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { X, Loader2, Bed } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { roomsService } from '@/services/rooms.service';

interface AddRoomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddRoomSheet({ isOpen, onClose, onSuccess }: AddRoomSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { mutate } = useSWRConfig();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'Standard',
    baseRate: '',
    notes: '',
  });

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await roomsService.create(
        { name: formData.name, type: formData.type, baseRate: Number(formData.baseRate), notes: formData.notes },
        token,
        membership.organization.id
      );
      mutate('rooms-list');
      setFormData({ name: '', type: 'Standard', baseRate: '', notes: '' });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add room');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const currency = membership?.organization?.currency || 'KES';

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          height: '100%',
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)' }}>
            <Bed size={20} />
            <span style={{ fontWeight: 600, fontSize: 17 }}>Add New Room</span>
          </div>
          <button type="button" onClick={onClose} style={{ padding: 8, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>{error}</div>}

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Room Name or Number *</label>
              <input
                type="text" required
                placeholder="e.g. 101 or Presidential Suite"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Room Type *</label>
              <select
                required value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', background: '#fff', outline: 'none' }}
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Standard">Standard</option>
                <option value="Suite">Suite</option>
                <option value="Deluxe">Deluxe</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Base Rate Per Night *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontWeight: 500, fontSize: 13, pointerEvents: 'none' }}>{currency}</span>
                <input
                  type="number" step="0.01" required min="0"
                  placeholder="0.00"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px 10px 52px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="Amenities, views, specific details..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, resize: 'none', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          {/* Pinned footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
