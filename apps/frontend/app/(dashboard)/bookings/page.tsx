'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import useSWR from 'swr';
import { bookingsService, type Booking } from '@/services/bookings.service';
import { Plus, CalendarDays, Search, Bed, User } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  RESERVED: 'bg-yellow-100 text-yellow-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW: 'bg-orange-100 text-orange-600',
};

const STATUS_LABELS: Record<string, string> = {
  RESERVED: 'Reserved',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Checked Out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

const TABS = ['All', 'Active', 'Upcoming', 'Past'] as const;
type Tab = typeof TABS[number];

function filterBookings(bookings: Booking[], tab: Tab, search: string): Booking[] {
  const now = new Date();
  let filtered = bookings;

  if (tab === 'Active') {
    filtered = bookings.filter((b) => b.status === 'CHECKED_IN');
  } else if (tab === 'Upcoming') {
    filtered = bookings.filter((b) => b.status === 'RESERVED' && new Date(b.checkInDate) >= now);
  } else if (tab === 'Past') {
    filtered = bookings.filter((b) => ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(b.status));
  }

  if (search) {
    filtered = filtered.filter((b) =>
      b.guest?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.room?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }

  return filtered;
}

export default function BookingsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [activeTab, setActiveTab] = useState<Tab>('Active');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: bookings, isLoading } = useSWR<Booking[]>(
    membership ? 'bookings-list' : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return bookingsService.getAll(token, membership.organization.id);
    }
  );

  const filtered = filterBookings(bookings || [], activeTab, searchQuery);

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bookings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track all reservations</p>
          </div>
          <Link
            href="/bookings/new"
            className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search guest or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:bg-white transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-white text-[var(--color-primary)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No bookings</h3>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try a different search.' : `No ${activeTab.toLowerCase()} bookings found.`}
            </p>
          </div>
        ) : (
          filtered.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all block group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors">
                    {booking.guest?.name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{booking.guest?.name ?? 'Unknown Guest'}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Bed className="h-3 w-3" />
                      {booking.room?.name ?? booking.roomId}
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${STATUS_COLORS[booking.status]}`}>
                  {STATUS_LABELS[booking.status]}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3">
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(booking.checkInDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  {' → '}
                  {new Date(booking.checkOutDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div className="font-semibold text-gray-700">
                  {membership?.organization?.currency} {Number(booking.ratePerNight).toLocaleString()}/night
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
