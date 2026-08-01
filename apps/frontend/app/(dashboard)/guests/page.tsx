'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import useSWR from 'swr';
import { guestsService, type Guest } from '@/services/guests.service';
import { Plus, Search, Users, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import { AddGuestSheet } from '@/components/guesthouse/AddGuestSheet';

export default function GuestsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: guests, isLoading } = useSWR<Guest[]>(
    membership ? 'guests-list' : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return guestsService.getAll(token, membership.organization.id);
    }
  );

  const filteredGuests = guests?.filter((g) => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.phone?.includes(searchQuery) ||
    g.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Guests</h1>
            <p className="text-sm text-gray-500 mt-1">Manage guest directory</p>
          </div>
          <button
            onClick={() => setShowAddGuest(true)}
            className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span>Add Guest</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Guest List */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No guests found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try a different search term.' : 'Add your first guest.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGuests.map((guest) => (
              <Link
                key={guest.id}
                href={`/guests/${guest.id}`}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all flex items-center gap-4 group"
              >
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg group-hover:bg-[var(--color-primary)]/10 group-hover:text-[var(--color-primary)] transition-colors">
                  {guest.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 truncate">{guest.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {guest.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {guest.phone}
                      </span>
                    )}
                    {guest.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{guest.email}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AddGuestSheet isOpen={showAddGuest} onClose={() => setShowAddGuest(false)} />
    </div>
  );
}
