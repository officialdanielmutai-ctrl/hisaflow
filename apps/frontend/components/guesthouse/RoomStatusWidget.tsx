'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { roomsService, type Room } from '@/services/rooms.service';
import { BedDouble, CheckCircle, Clock, AlertTriangle, Hammer, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function RoomStatusWidget() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  const { data: rooms, isLoading } = useSWR<Room[]>(
    membership ? 'dashboard-rooms-list' : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return roomsService.getAll(token, membership.organization.id);
    }
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 mb-6 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return null; // Don't show if no rooms exist
  }

  // Calculate stats
  const activeRooms = rooms.filter(r => r.isActive);
  const occupied = activeRooms.filter(r => r.status === 'OCCUPIED').length;
  const vacantClean = activeRooms.filter(r => r.status === 'VACANT_CLEAN').length;
  const vacantDirty = activeRooms.filter(r => r.status === 'VACANT_DIRTY').length;
  const maintenance = activeRooms.filter(r => r.status === 'MAINTENANCE').length;
  const total = activeRooms.length;

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-base text-[var(--color-text-primary)] flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-[var(--color-primary)]" />
          Room Status
        </h2>
        <Link href="/rooms" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
          Manage rooms <span className="ml-1 text-lg leading-none mt-0.5">›</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Occupancy Card */}
        <div className="col-span-2 rounded-2xl bg-[var(--color-primary)] p-4 text-white relative overflow-hidden shadow-sm">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Today's Occupancy</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{occupancyRate}%</span>
              </div>
              <p className="text-white/90 text-xs mt-1">
                {occupied} of {total} rooms occupied
              </p>
            </div>
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <BedDouble className="h-8 w-8 text-white" />
            </div>
          </div>
          {/* Decorative background circle */}
          <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
        </div>

        {/* Stats Grid */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{vacantClean}</p>
            <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase mt-1 tracking-wider">Ready</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{vacantDirty}</p>
            <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase mt-1 tracking-wider">Dirty</p>
          </div>
        </div>
      </div>
    </div>
  );
}
