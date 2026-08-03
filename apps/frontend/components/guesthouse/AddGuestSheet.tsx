'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { X, Loader2, User } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { guestsService } from '@/services/guests.service';

interface AddGuestSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddGuestSheet({ isOpen, onClose, onSuccess }: AddGuestSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { mutate } = useSWRConfig();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    idNumber: '',
    email: '',
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
      await guestsService.create(
        {
          name: formData.name,
          phone: formData.phone || undefined,
          idNumber: formData.idNumber || undefined,
          email: formData.email || undefined,
          notes: formData.notes || undefined,
        },
        token,
        membership.organization.id
      );
      mutate('guests-list');
      setFormData({ name: '', phone: '', idNumber: '', email: '', notes: '' });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add guest');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

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
            <User size={20} />
            <span style={{ fontWeight: 600, fontSize: 17 }}>Add New Guest</span>
          </div>
          <button type="button" onClick={onClose} style={{ padding: 8, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>{error}</div>}

            {[
              { label: 'Full Name *', key: 'name', type: 'text', required: true },
              { label: 'Phone Number (Optional)', key: 'phone', type: 'tel', required: false },
              { label: 'ID / Passport (Optional)', key: 'idNumber', type: 'text', required: false },
              { label: 'Email (Optional)', key: 'email', type: 'email', required: false },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={(formData as any)[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            ))}

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Notes (Optional)</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, resize: 'none', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          {/* Pinned footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Save Guest'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
