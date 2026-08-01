'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import useSWR from 'swr';
import { roomsService, type Room } from '@/services/rooms.service';
import { ArrowLeft, Bed, Edit3, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EditRoomSheet } from '@/components/guesthouse/EditRoomSheet';

export default function RoomDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();

  const [showEdit, setShowEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const { data: room, isLoading } = useSWR<Room>(
    membership ? `room-${params.id}` : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return roomsService.getById(params.id, token, membership.organization.id);
    }
  );

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to deactivate this room?')) return;
    
    setIsDeleting(true);
    setError('');
    try {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      await roomsService.deactivate(params.id, token, membership.organization.id);
      router.push('/rooms');
    } catch (err: any) {
      setError(err.message || 'Failed to delete room');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-6 text-center text-gray-500">
        Room not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/rooms" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{room.name}</h1>
            <p className="text-sm text-gray-500">{room.type}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[var(--color-primary)]/10 p-2.5 rounded-xl text-[var(--color-primary)]">
              <Bed className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Room Details</h2>
              <p className="text-xs text-gray-500">Current status and info</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-sm font-semibold text-gray-900">{room.status}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Base Rate</div>
              <div className="text-sm font-semibold text-gray-900">
                {membership?.organization?.currency} {Number(room.baseRate).toLocaleString()}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-500 mb-1">Notes</div>
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg min-h-[60px]">
                {room.notes || 'No notes provided.'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {(isOwner || isManager) && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit3 className="h-4 w-4" />
              Edit Room
            </button>
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Room
              </button>
            )}
          </div>
        )}
      </div>

      <EditRoomSheet room={room} isOpen={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}
