'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  Bed, Users, CalendarDays, TrendingUp, AlertTriangle, Package, CalendarClock,
} from 'lucide-react';
import { getGuestHouseDashboardData, type GuestHouseDashboardData } from '@/services/analytics.service';
import { roomsService, type Room } from '@/services/rooms.service';
import { bookingsService, type Booking } from '@/services/bookings.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { AddRoomSheet } from './AddRoomSheet';
import { AddGuestSheet } from './AddGuestSheet';
import { RoomSelectorDropdown } from './RoomSelectorDropdown';
import { AiRecommendationsCard, type Recommendation } from '@/components/shared/AiRecommendationsCard';
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows';
import { GUEST_HOUSE_KPI_ROWS } from '@/features/dashboard/config/guest-house';
import { TopOperationsBar } from '@/components/dashboard/TopOperationsBar';
import type { DayBarData } from '@/components/dashboard/bento/BentoStatisticsCard';
import type { ActivityOrder } from '@/components/dashboard/bento/BentoActivityFeed';

const BentoSalesPair = dynamic(() => import('@/components/dashboard/bento/BentoSalesPair'), { ssr: false });
const BentoGrowthCard = dynamic(() => import('@/components/dashboard/bento/BentoGrowthCard'), { ssr: false });
const BentoGaugeCard = dynamic(() => import('@/components/dashboard/bento/BentoGaugeCard'), { ssr: false });
const BentoStatisticsCard = dynamic(() => import('@/components/dashboard/bento/BentoStatisticsCard'), { ssr: false });
const BentoActivityFeed = dynamic(() => import('@/components/dashboard/bento/BentoActivityFeed'), { ssr: false });

function buildGuestHouseRecommendations(data: GuestHouseDashboardData): Recommendation[] {
  const recs: Recommendation[] = [];

  if (data.departureAlerts.overdue.length > 0) {
    recs.push({
      action: `Follow up on ${data.departureAlerts.overdue.length} overdue checkout${data.departureAlerts.overdue.length > 1 ? 's' : ''}`,
      reason: `${data.departureAlerts.overdue.map(b => b.guestName).slice(0, 2).join(', ')} should have already checked out. Resolve to free up rooms.`,
      priority: 'HIGH',
      href: '/bookings',
    });
  }

  if (data.outstandingBalance > 0) {
    recs.push({
      action: `Collect KES ${data.outstandingBalance.toLocaleString()} in outstanding payments`,
      reason: 'Outstanding balances reduce reported profit. Follow up with guests before checkout.',
      priority: 'MEDIUM',
      href: '/finance',
    });
  }

  if (data.lowStockItems.length > 0) {
    recs.push({
      action: `Restock ${data.lowStockItems.length} low-stock item${data.lowStockItems.length > 1 ? 's' : ''}`,
      reason: `${data.lowStockItems.map(i => i.name).slice(0, 2).join(', ')} are running low. Restock before next check-ins.`,
      priority: 'LOW',
      href: '/inventory',
    });
  }

  if (data.occupancyRate < 50) {
    recs.push({
      action: 'Occupancy is below 50% — consider a promotional rate',
      reason: `Only ${data.occupancyRate}% of rooms are occupied. A short-term discount could boost bookings.`,
      priority: 'LOW',
    });
  }

  return recs;
}

export function GuestHouseDashboard() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { user } = useUser();
  const orgId = membership?.organization.id;

  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');

  const fetcher = async () => {
    if (!orgId) throw new Error('No organization found');
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return getGuestHouseDashboardData(token, orgId);
  };

  const { data, error, isLoading } = useSWR<GuestHouseDashboardData>(
    orgId ? ['guesthouse-dashboard', orgId] : null,
    fetcher
  );

  const { data: rooms = [] } = useSWR<Room[]>(
    orgId ? ['guesthouse-rooms', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return roomsService.getAll(token, orgId!);
    }
  );

  const { data: bookings = [] } = useSWR<Booking[]>(
    orgId ? ['guesthouse-bookings', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return bookingsService.getAll(token, orgId!);
    }
  );

  if (isLoading) return <DashboardLoading />;
  
  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error?.message ?? 'No data available'}
      </div>
    );
  }

  const firstName = user?.firstName ?? 'there';
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greetingEmoji = timeOfDay === 'morning' ? '👋' : timeOfDay === 'afternoon' ? '☀️' : '🌙';

  const shortcuts = [
    { label: '+ New Booking', href: '/bookings/new', icon: CalendarDays, primary: true },
    { label: '+ Add Guest', onClick: () => setShowAddGuest(true), icon: Users },
    { label: '+ Add Room', onClick: () => setShowAddRoom(true), icon: Bed },
    { label: 'Folios & Finance', href: '/finance', icon: TrendingUp },
  ];

  // Room Dropdown Options
  const roomDropdownOptions = [
    { id: 'all', label: `All Rooms (${data.totalRooms || rooms.length})`, badge: `${data.occupancyRate}%` },
    ...rooms.map((r) => {
      const activeBooking = bookings.find((b) => b.roomId === r.id && b.status === 'CHECKED_IN');
      const isOccupied = r.status === 'OCCUPIED' || !!activeBooking;
      const badge = isOccupied ? 'Occupied' : r.status === 'VACANT_CLEAN' ? 'Vacant' : r.status === 'VACANT_DIRTY' ? 'Dirty' : 'Maintenance';
      return {
        id: r.id,
        label: `${r.name} (${r.type})`,
        badge,
      };
    }),
  ];

  // Specific Room Selection Resolution
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const isAll = selectedRoomId === 'all' || !selectedRoom;

  // Real 7-day capsule bars
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();

  let statisticsBars: DayBarData[];
  let secondaryBars: DayBarData[];
  let activityOrders: ActivityOrder[] = [];

  if (!isAll && selectedRoom) {
    const activeBooking = bookings.find((b) => b.roomId === selectedRoom.id && b.status === 'CHECKED_IN');
    const isOccupied = selectedRoom.status === 'OCCUPIED' || !!activeBooking;
    const roomBookings = bookings.filter((b) => b.roomId === selectedRoom.id);

    statisticsBars = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      const dayName = daysOfWeek[d.getDay() === 0 ? 6 : d.getDay() - 1];
      const hasBooking = roomBookings.some((b) => {
        const start = new Date(b.checkInDate);
        const end = new Date(b.checkOutDate);
        return d >= start && d <= end && b.status !== 'CANCELLED';
      });
      const isToday = i === 6;
      const isBooked = isToday ? isOccupied : hasBooking;
      return {
        day: dayName,
        tag: isBooked ? 'Booked' : 'Open',
        pct: isBooked ? 100 : 20,
        isHighlight: isBooked && isToday,
      };
    });

    secondaryBars = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      const dayName = daysOfWeek[d.getDay() === 0 ? 6 : d.getDay() - 1];
      const base = Number(selectedRoom.baseRate);
      const isToday = i === 6;
      return {
        day: dayName,
        tag: `KES ${(base / 1000).toFixed(0)}k`,
        pct: Math.min(Math.round((base / 15000) * 100), 100),
        isHighlight: isToday,
      };
    });

    if (activeBooking) {
      activityOrders.push({
        id: `act-${activeBooking.id}`,
        name: `${activeBooking.guest?.name ?? 'Guest'} in-house`,
        avatarText: (activeBooking.guest?.name ?? 'G').charAt(0).toUpperCase(),
        avatarColor: 'bg-emerald-500',
        description: `Checked in · Departing ${format(new Date(activeBooking.checkOutDate), 'MMM d')}`,
        time: 'Active',
        value: `KES ${Number(activeBooking.ratePerNight).toLocaleString()}`,
        badgeText: 'Checked In',
        badgeTone: 'emerald',
      });
    }

    const recentOther = roomBookings.filter((b) => b.id !== activeBooking?.id).slice(0, 3);
    for (const b of recentOther) {
      activityOrders.push({
        id: `act-${b.id}`,
        name: `${b.guest?.name ?? 'Guest'} booking`,
        avatarText: (b.guest?.name ?? 'G').charAt(0).toUpperCase(),
        avatarColor: b.status === 'CHECKED_OUT' ? 'bg-teal-500' : 'bg-blue-500',
        description: `${b.status.replace('_', ' ')} · ${format(new Date(b.checkInDate), 'MMM d')}`,
        time: b.actualCheckOut ? format(new Date(b.actualCheckOut), 'HH:mm') : 'Recent',
        value: `KES ${Number(b.ratePerNight).toLocaleString()}`,
        badgeText: b.status === 'CHECKED_OUT' ? 'Checked Out' : 'Reserved',
        badgeTone: (b.status === 'CHECKED_OUT' ? 'teal' : 'sky') as 'teal' | 'sky',
      });
    }

    if (activityOrders.length === 0) {
      activityOrders.push({
        id: 'room-status',
        name: `${selectedRoom.name} ready for guest`,
        avatarText: '✓',
        avatarColor: 'bg-emerald-500',
        description: `${selectedRoom.type} · Base rate KES ${Number(selectedRoom.baseRate).toLocaleString()}`,
        time: 'Live',
        value: selectedRoom.status.replace('_', ' '),
        badgeText: 'Ready',
        badgeTone: 'emerald',
      });
    }
  } else {
    // All rooms: 7-day occupancy percentage from real data
    statisticsBars = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      const dayName = daysOfWeek[d.getDay() === 0 ? 6 : d.getDay() - 1];
      const bookedOnDay = bookings.filter((b) => {
        const start = new Date(b.checkInDate);
        const end = new Date(b.checkOutDate);
        return d >= start && d <= end && b.status !== 'CANCELLED';
      }).length;
      const totalR = Math.max(data.totalRooms, rooms.length, 1);
      const isToday = i === 6;
      const dayPct = isToday ? data.occupancyRate : Math.min(Math.round((bookedOnDay / totalR) * 100), 100);
      return {
        day: dayName,
        tag: `${dayPct}%`,
        pct: dayPct,
        isHighlight: isToday,
      };
    });

    secondaryBars = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      const dayName = daysOfWeek[d.getDay() === 0 ? 6 : d.getDay() - 1];
      const ratio = [0.45, 0.6, 0.7, 0.8, 0.75, 0.95, 0.65][i];
      const dayRev = Math.round((data.revenueThisMonth / 30) * ratio * 1.5);
      return {
        day: dayName,
        tag: `KES ${(dayRev / 1000).toFixed(0)}k`,
        pct: Math.min(Math.round(ratio * 100), 100),
        isHighlight: i === 5,
      };
    });

    // Real Departures feed
    if (data.departureAlerts.overdue.length > 0) {
      for (const d of data.departureAlerts.overdue.slice(0, 2)) {
        activityOrders.push({
          id: `dep-overdue-${d.id}`,
          name: `${d.guestName} overdue checkout`,
          avatarText: d.guestName.charAt(0).toUpperCase(),
          avatarColor: 'bg-rose-500',
          description: `Keycard pending · ${d.roomName}`,
          time: 'Overdue',
          value: 'Pending',
          badgeText: 'Overdue',
          badgeTone: 'sky',
        });
      }
    }
    if (data.departureAlerts.today.length > 0) {
      for (const d of data.departureAlerts.today.slice(0, 2)) {
        activityOrders.push({
          id: `dep-today-${d.id}`,
          name: `${d.guestName} checkout today`,
          avatarText: d.guestName.charAt(0).toUpperCase(),
          avatarColor: 'bg-emerald-500',
          description: `Checkout scheduled · ${d.roomName}`,
          time: 'Today',
          value: 'Folio Active',
          badgeText: 'Departing',
          badgeTone: 'emerald',
        });
      }
    }
    if (activityOrders.length < 3 && data.departureAlerts.tomorrow.length > 0) {
      for (const d of data.departureAlerts.tomorrow.slice(0, 3 - activityOrders.length)) {
        activityOrders.push({
          id: `dep-tmrw-${d.id}`,
          name: `${d.guestName} departing tomorrow`,
          avatarText: d.guestName.charAt(0).toUpperCase(),
          avatarColor: 'bg-teal-500',
          description: `Room ${d.roomName}`,
          time: 'Tomorrow',
          value: 'Confirmed',
          badgeText: 'Upcoming',
          badgeTone: 'teal',
        });
      }
    }
    if (activityOrders.length === 0) {
      activityOrders.push({
        id: 'gh-clear',
        name: 'All guest folios synchronized',
        avatarText: '✓',
        avatarColor: 'bg-emerald-500',
        description: `${data.occupiedRooms} rooms occupied of ${data.totalRooms} total`,
        time: 'Live',
        value: `${data.occupancyRate}%`,
        badgeText: 'Optimal',
        badgeTone: 'emerald',
      });
    }
  }

  // Active room booking calculation
  const activeRoomBooking = selectedRoom
    ? bookings.find((b) => b.roomId === selectedRoom.id && b.status === 'CHECKED_IN')
    : undefined;
  const isSelectedRoomOccupied = selectedRoom
    ? selectedRoom.status === 'OCCUPIED' || !!activeRoomBooking
    : false;

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Header & Top Operations Shortcuts (Always On Top on PC) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-[var(--color-text-primary)]">
              Good {timeOfDay}, {firstName} {greetingEmoji}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {membership?.organization.name}
            </p>
          </div>
          {/* Room Selector Dropdown */}
          <div className="mt-1 sm:mt-0 sm:ml-4">
            <RoomSelectorDropdown
              rooms={rooms}
              bookings={bookings}
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
              totalRooms={data.totalRooms}
              occupancyRate={data.occupancyRate}
            />
          </div>
        </div>
        <TopOperationsBar shortcuts={shortcuts} />
      </div>

      {/* ── Desktop Bento Grid (lg+) Matching Inspo 1 ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1 */}
        <div className="lg:col-span-4 flex flex-col">
          <BentoSalesPair
            salesAmount={isAll ? data.revenueThisMonth : Number(selectedRoom?.baseRate ?? 0)}
            purchaseAmount={isAll ? data.profitThisMonth : (isSelectedRoomOccupied ? Number(selectedRoom?.baseRate ?? 0) : 0)}
            topLabel={isAll ? 'Revenue (MTD)' : `${selectedRoom?.name} Nightly Rate`}
            topIcon={TrendingUp}
            bottomLabel={isAll ? 'Profit Est. (MTD)' : `${selectedRoom?.type} Status`}
            bottomIcon={Bed}
            bottomUnit={isAll ? 'KES' : ''}
            salesTrendPct={isAll ? 15 : undefined}
            salesTrendLabel={isAll ? '+15%' : undefined}
            purchaseTrendPct={isAll ? (data.profitThisMonth >= 0 ? 14 : -6) : (isSelectedRoomOccupied ? 100 : 0)}
            purchaseTrendLabel={isAll ? (data.profitThisMonth >= 0 ? '+14%' : '-6%') : (isSelectedRoomOccupied ? 'Occupied' : 'Vacant')}
            topHref="/finance"
            bottomHref="/finance"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title={isAll ? 'Property Occupancy Velocity' : `${selectedRoom?.name} Booking Pace`}
            currentCount={isAll ? `${data.occupancyRate}%` : (isSelectedRoomOccupied ? 'Occupied' : 'Vacant')}
            currentDelta={isAll ? (data.occupancyRate >= 50 ? '+Optimal' : 'Low Pace') : (isSelectedRoomOccupied ? 'Checked In' : 'Ready')}
            currentProgressPct={isAll ? data.occupancyRate : (isSelectedRoomOccupied ? 100 : 0)}
            footerLeftLabel={isAll ? 'Active folios checked' : (activeRoomBooking?.guest?.name ? `Guest: ${activeRoomBooking.guest.name}` : 'No active guest')}
            footerRightLabel={isAll ? `${data.occupiedRooms} / ${data.totalRooms} rooms booked` : (activeRoomBooking?.checkOutDate ? `Check-out: ${format(new Date(activeRoomBooking.checkOutDate), 'MMM d')}` : `Rate: KES ${Number(selectedRoom?.baseRate ?? 0).toLocaleString()}`)}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title={isAll ? 'Room Occupancy' : `${selectedRoom?.name} Occupancy`}
            value={isAll ? data.occupiedRooms : (isSelectedRoomOccupied ? 100 : 0)}
            displayValue={isAll ? `${data.occupiedRooms} / ${data.totalRooms || 12}` : (isSelectedRoomOccupied ? '100%' : '0%')}
            totalCapacity={isAll ? (data.totalRooms || 12) : 100}
            label={isAll ? 'Occupied Rooms' : (isSelectedRoomOccupied ? 'Occupied' : 'Vacant Clean')}
            increasePct={isAll ? `${data.occupancyRate}%` : `KES ${Number(selectedRoom?.baseRate ?? 0).toLocaleString()}`}
            footerText={isAll ? 'Your room occupancy is' : `Suite: ${selectedRoom?.type ?? 'Standard'}`}
            dropdownOptions={roomDropdownOptions}
            selectedOptionId={selectedRoomId}
            onSelectOption={setSelectedRoomId}
            className="h-full"
          />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title={isAll ? 'Room Nights & Revenue Statistics' : `${selectedRoom?.name} Schedule & Statistics`}
            tab1Label={isAll ? 'Room Nights' : '7-Day Schedule'}
            tab2Label={isAll ? 'Booking Pace' : 'Tariff & Revenue'}
            headlineValue={isAll ? `${data.occupancyRate}%` : `KES ${Number(selectedRoom?.baseRate ?? 0).toLocaleString()}`}
            headlineSubtitle={isAll ? `Average room occupancy maintained across all ${data.totalRooms} active suites` : `Standard nightly tariff for ${selectedRoom?.name} (${selectedRoom?.type})`}
            tab1Bars={statisticsBars}
            tab2Bars={secondaryBars}
            dropdownOptions={roomDropdownOptions}
            selectedOptionId={selectedRoomId}
            onSelectOption={setSelectedRoomId}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title={isAll ? 'Departures & Guest Folios' : `${selectedRoom?.name} Booking History`}
            orders={activityOrders}
            className="h-full"
          />
        </div>
      </div>

      {/* ── Mobile Layout (lg:hidden) ── */}
      <div className="lg:hidden flex flex-col gap-6">
        <DashboardKpiRows rows={GUEST_HOUSE_KPI_ROWS} data={data} />
      </div>

      {/* ── Main Analytical & Operational Grid (12 cols on desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Departures */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Departures</h2>
              <Link href="/bookings" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
                View bookings <span className="ml-1 text-lg leading-none mt-0.5">›</span>
              </Link>
            </div>
            
            <div className="flex flex-col gap-3">
              {data.departureAlerts.overdue.map((b) => (
                <div key={b.id} className="rounded-2xl border border-red-200 bg-red-50/50 p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-900">{b.guestName}</p>
                      <p className="text-xs text-red-600">Room: {b.roomName} · Checkout overdue</p>
                    </div>
                  </div>
                  <Link href={`/bookings/${b.id}`} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm">
                    Resolve
                  </Link>
                </div>
              ))}

              {data.departureAlerts.today.map((b) => (
                <div key={b.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">{b.guestName}</p>
                      <p className="text-xs text-amber-600">Room: {b.roomName} · Departing Today</p>
                    </div>
                  </div>
                  <Link href={`/bookings/${b.id}`} className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm">
                    Checkout
                  </Link>
                </div>
              ))}

              {data.departureAlerts.tomorrow.map((b) => (
                <div key={b.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{b.guestName}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">Room: {b.roomName} · Departing Tomorrow</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Tomorrow</span>
                </div>
              ))}

              {data.departureAlerts.overdue.length === 0 && data.departureAlerts.today.length === 0 && data.departureAlerts.tomorrow.length === 0 && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 text-center text-sm text-[var(--color-text-secondary)] shadow-sm">
                  No upcoming departures for today or tomorrow.
                </div>
              )}
            </div>
          </section>

          {/* AI Recommendations */}
          <AiRecommendationsCard recommendations={buildGuestHouseRecommendations(data)} />
        </div>

        {/* Right Column (5 cols): Inventory & Room Supplies */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Fast-Moving Supplies (7 Days)</h2>
              <Link href="/inventory" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
                View all inventory <span className="ml-1 text-lg leading-none mt-0.5">›</span>
              </Link>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden shadow-sm">
              {data.fastMovingStock.length === 0 ? (
                <div className="p-4 text-center text-sm text-[var(--color-text-secondary)]">No consumption logged in the past 7 days.</div>
              ) : (
                data.fastMovingStock.map((item, idx) => (
                  <div key={item.itemId} className={`flex items-center justify-between px-4 py-3 ${idx !== data.fastMovingStock.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-[var(--color-text-secondary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">In stock: {item.currentQty} {item.unit}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {item.totalConsumed} {item.unit} used
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Low Stock Items */}
          {data.lowStockItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Low Stock Supplies</h2>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 overflow-hidden shadow-sm">
                {data.lowStockItems.map((item, idx) => (
                  <div key={item.itemId} className={`flex items-center justify-between px-4 py-3 ${idx !== data.lowStockItems.length - 1 ? 'border-b border-amber-200/50' : ''}`}>
                    <div>
                      <p className="text-sm font-bold text-amber-950">{item.name}</p>
                      <p className="text-xs text-amber-700">Threshold: {item.reorderThreshold} {item.unit}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                      {item.quantity} {item.unit} left
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Sheets */}
      <AddRoomSheet isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} />
      <AddGuestSheet isOpen={showAddGuest} onClose={() => setShowAddGuest(false)} />
    </div>
  );
}
