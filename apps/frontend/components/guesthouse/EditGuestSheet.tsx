'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { X, Loader2, User } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { guestsService, type Guest } from '@/services/guests.service';

interface EditGuestSheetProps {
  guest: Guest;
  isOpen: boolean;
  onClose: () => void;
}

export function EditGuestSheet({ guest, isOpen, onClose }: EditGuestSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { mutate } = useSWRConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: guest.name,
    phone: guest.phone || '',
    idNumber: guest.idNumber || '',
    email: guest.email || '',
    notes: guest.notes || '',
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: guest.name,
        phone: guest.phone || '',
        idNumber: guest.idNumber || '',
        email: guest.email || '',
        notes: guest.notes || '',
      });
      setError('');
    }
  }, [isOpen, guest]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;

    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await guestsService.update(
        guest.id,
        {
          name: formData.name,
          phone: formData.phone || null,
          idNumber: formData.idNumber || null,
          email: formData.email || null,
          notes: formData.notes || null,
        },
        token,
        membership.organization.id
      );

      mutate('guests-list');
      mutate(`guest-${guest.id}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update guest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <User className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Edit Guest</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="edit-guest-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID / Passport Number (Optional)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all resize-none"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            type="submit"
            form="edit-guest-form"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-white font-medium bg-[var(--color-primary)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
