'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import useSWR from 'swr';
import { roomsService, type Room } from '@/services/rooms.service';
import { Plus, Bed, Search, Settings2, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { AddRoomSheet } from '@/components/guesthouse/AddRoomSheet';

const STATUS_COLORS: Record<string, string> = {
  VACANT_CLEAN: 'bg-green-100 text-green-700',
  VACANT_DIRTY: 'bg-orange-100 text-orange-700',
  OCCUPIED: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  VACANT_CLEAN: 'Clean',
  VACANT_DIRTY: 'Dirty',
  OCCUPIED: 'Occupied',
  MAINTENANCE: 'Maintenance',
};

export default function RoomsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rooms, isLoading } = useSWR<Room[]>(
    membership ? 'rooms-list' : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return roomsService.getAll(token, membership.organization.id);
    }
  );

  const filteredRooms = rooms?.filter((r) => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Rooms</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your guest house rooms</p>
          </div>
          {(isOwner || isManager) && (
            <button
              onClick={() => setShowAddRoom(true)}
              className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              <span>Add Room</span>
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:bg-white transition-all"
            />
          </div>
          <button className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Room Grid */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bed className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No rooms found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try a different search term.' : 'Add your first room to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredRooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all flex flex-col group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-[var(--color-primary)]/10 p-2 rounded-lg text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors">
                    <Bed className="h-5 w-5" />
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${STATUS_COLORS[room.status]}`}>
                    {STATUS_LABELS[room.status]}
                  </div>
                </div>
                
                <h3 className="text-base font-bold text-gray-900 mb-1">{room.name}</h3>
                <p className="text-xs text-gray-500 font-medium mb-3">{room.type}</p>
                
                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-500">Rate</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {membership?.organization?.currency} {Number(room.baseRate).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AddRoomSheet isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} />
    </div>
  );
}
