'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bed, Building2, Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Room } from '@/services/rooms.service';
import type { Booking } from '@/services/bookings.service';

export interface RoomSelectorDropdownProps {
  rooms: Room[];
  bookings?: Booking[];
  selectedRoomId: string; // 'all' or room ID
  onSelectRoom: (roomId: string) => void;
  totalRooms?: number;
  occupancyRate?: number;
  className?: string;
}

export function RoomSelectorDropdown({
  rooms,
  bookings = [],
  selectedRoomId,
  onSelectRoom,
  totalRooms = rooms.length,
  occupancyRate = 0,
  className,
}: RoomSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const isAllSelected = selectedRoomId === 'all' || !selectedRoom;

  // Filter rooms by search query
  const filteredRooms = rooms.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (room: Room) => {
    const activeBooking = bookings.find(
      (b) => b.roomId === room.id && b.status === 'CHECKED_IN',
    );
    const isOccupied = room.status === 'OCCUPIED' || !!activeBooking;

    if (isOccupied) {
      return {
        label: 'Occupied',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      };
    }
    if (room.status === 'VACANT_CLEAN') {
      return {
        label: 'Vacant Clean',
        classes: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
        dot: 'bg-sky-500',
      };
    }
    if (room.status === 'VACANT_DIRTY') {
      return {
        label: 'Needs Cleaning',
        classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    }
    return {
      label: 'Maintenance',
      classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      dot: 'bg-rose-500',
    };
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all shadow-sm select-none',
          'bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)]',
          isOpen && 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20',
        )}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="h-6 w-6 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
          {isAllSelected ? <Building2 className="h-3.5 w-3.5" /> : <Bed className="h-3.5 w-3.5" />}
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold leading-none">
            Room Scope
          </span>
          <span className="text-xs font-black truncate max-w-[140px] sm:max-w-[180px]">
            {isAllSelected ? `All Rooms (${totalRooms})` : selectedRoom.name}
          </span>
        </div>

        {/* Selected Status Pill */}
        {isAllSelected ? (
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold shrink-0">
            {occupancyRate}% Occ.
          </span>
        ) : (
          (() => {
            const badge = getStatusBadge(selectedRoom);
            return (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 flex items-center gap-1',
                  badge.classes,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />
                {badge.label}
              </span>
            );
          })()
        )}

        <ChevronDown
          className={cn(
            'h-4 w-4 text-[var(--color-text-secondary)] transition-transform duration-200 shrink-0',
            isOpen && 'transform rotate-180',
          )}
        />
      </button>

      {/* ── Dropdown Menu Popover ── */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 max-h-[380px] rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Filter by Room
              </span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">
                {rooms.length} suites registered
              </span>
            </div>

            {/* Quick Search */}
            {rooms.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto no-scrollbar p-1.5 flex flex-col gap-1 max-h-[280px]">
            {/* Option: All Rooms (Overview) */}
            <button
              type="button"
              onClick={() => {
                onSelectRoom('all');
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between p-2.5 rounded-2xl transition-all text-left text-xs',
                isAllSelected
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30'
                  : 'hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-medium',
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'h-7 w-7 rounded-xl flex items-center justify-center shrink-0',
                    isAllSelected ? 'bg-emerald-500 text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
                  )}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold leading-tight">All Rooms (Property Overview)</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    {totalRooms} total suites · Aggregate analytics
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                  {occupancyRate}%
                </span>
                {isAllSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              </div>
            </button>

            {/* Divider */}
            <div className="h-px bg-[var(--color-border)] my-1" />

            {/* Individual Room Options */}
            {filteredRooms.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--color-text-secondary)]">
                No rooms matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = selectedRoomId === room.id;
                const badge = getStatusBadge(room);
                const activeBooking = bookings.find(
                  (b) => b.roomId === room.id && b.status === 'CHECKED_IN',
                );

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      onSelectRoom(room.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-2.5 rounded-2xl transition-all text-left text-xs',
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30'
                        : 'hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-medium',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-xl flex items-center justify-center shrink-0',
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
                        )}
                      >
                        <Bed className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate leading-tight">{room.name}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)] truncate mt-0.5">
                          {room.type} · KES {Number(room.baseRate).toLocaleString()}/night
                          {activeBooking?.guest?.name ? ` · ${activeBooking.guest.name}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold border flex items-center gap-1',
                          badge.classes,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />
                        {badge.label}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
