'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { X, Loader2, Bed } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { roomsService, type Room } from '@/services/rooms.service';

interface EditRoomSheetProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
}

export function EditRoomSheet({ room, isOpen, onClose }: EditRoomSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { mutate } = useSWRConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: room.name,
    type: room.type,
    baseRate: room.baseRate.toString(),
    notes: room.notes || '',
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: room.name,
        type: room.type,
        baseRate: room.baseRate.toString(),
        notes: room.notes || '',
      });
      setError('');
    }
  }, [isOpen, room]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;

    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await roomsService.update(
        room.id,
        {
          name: formData.name,
          type: formData.type,
          baseRate: Number(formData.baseRate),
          notes: formData.notes,
        },
        token,
        membership.organization.id
      );

      mutate('rooms-list');
      mutate(`room-${room.id}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <Bed className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Edit Room</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="edit-room-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Name or Number
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
                Room Type
              </label>
              <select
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Standard">Standard</option>
                <option value="Suite">Suite</option>
                <option value="Deluxe">Deluxe</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Rate (Per Night)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  {membership?.organization?.currency || 'KES'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  className="w-full pl-14 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                />
              </div>
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
            form="edit-room-form"
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
