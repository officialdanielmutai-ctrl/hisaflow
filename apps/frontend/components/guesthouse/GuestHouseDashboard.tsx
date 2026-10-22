'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  Bed, Users, CalendarDays, TrendingUp, AlertTriangle, Package, CalendarClock
} from 'lucide-react';
import { getGuestHouseDashboardData, type GuestHouseDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import dynamic from 'next/dynamic';
import { AddRoomSheet } from './AddRoomSheet';
import { AddGuestSheet } from './AddGuestSheet';
import { AiRecommendationsCard, type Recommendation } from '@/components/shared/AiRecommendationsCard';
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows';
import { GUEST_HOUSE_KPI_ROWS } from '@/features/dashboard/config/guest-house';
import { TopOperationsBar } from '@/components/dashboard/TopOperationsBar';

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

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Header & Top Operations Shortcuts (Always On Top on PC) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-[var(--color-text-primary)]">
            Good {timeOfDay}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {membership?.organization.name}
          </p>
        </div>
        <TopOperationsBar shortcuts={shortcuts} />
      </div>

      {/* ── Desktop Bento Grid (lg+) Matching Inspo 1 ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1 */}
        <div className="lg:col-span-4 flex flex-col">
          <BentoSalesPair
            salesAmount={data.revenueThisMonth}
            purchaseAmount={data.profitThisMonth}
            topLabel="Revenue (MTD)"
            topIcon={TrendingUp}
            bottomLabel="Profit Est. (MTD)"
            bottomIcon={Bed}
            salesTrendPct={15}
            salesTrendLabel="+15%"
            purchaseTrendPct={data.profitThisMonth >= 0 ? 14 : -6}
            purchaseTrendLabel={data.profitThisMonth >= 0 ? '+14%' : '-6%'}
            topHref="/finance"
            bottomHref="/finance"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Occupancy Velocity"
            currentCount={`${data.occupancyRate}%`}
            currentDelta="+15%"
            currentProgressPct={data.occupancyRate}
            footerLeftLabel="Active folios checked"
            footerRightLabel={`${data.occupiedRooms} / ${data.totalRooms} rooms booked`}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Room Occupancy"
            value={data.occupiedRooms}
            totalCapacity={data.totalRooms || 12}
            label="Occupied Rooms"
            increasePct={`${data.occupancyRate}%`}
            footerText="Your room occupancy is"
            className="h-full"
          />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Room Nights & Revenue Statistics"
            tab1Label="Room Nights"
            tab2Label="Booking Pace"
            headlineValue={`${data.occupancyRate}%`}
            headlineSubtitle="Average room occupancy maintained across all active suites"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Departures & Guest Folios"
            orders={[
              {
                id: 'act-1',
                name: data.departureAlerts.today[0]?.guestName ? `${data.departureAlerts.today[0].guestName} checkout` : 'Sarah Collins checked out',
                avatarText: 'S',
                avatarColor: 'bg-emerald-500',
                description: data.departureAlerts.today[0]?.roomName ? `Folio cleared · ${data.departureAlerts.today[0].roomName}` : 'Folio cleared · Deluxe Suite 102',
                time: '10:30',
                value: 'KES 24,000',
                badgeText: 'Checked Out',
                badgeTone: 'emerald',
              },
              {
                id: 'act-2',
                name: data.departureAlerts.overdue[0]?.guestName ? `${data.departureAlerts.overdue[0].guestName} overdue` : 'David Mwangi late checkout',
                avatarText: 'D',
                avatarColor: 'bg-rose-500',
                description: data.departureAlerts.overdue[0]?.roomName ? `Keycard pending · ${data.departureAlerts.overdue[0].roomName}` : 'Keycard pending · Room 204',
                time: '12:00',
                value: 'KES 18,500',
                badgeText: 'Overdue',
                badgeTone: 'sky',
              },
              {
                id: 'act-3',
                name: 'New reservation confirmed',
                avatarText: 'R',
                avatarColor: 'bg-teal-500',
                description: '2 nights · Executive Suite',
                time: '09:15',
                value: 'KES 32,000',
                badgeText: 'Confirmed',
                badgeTone: 'teal',
              },
            ]}
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
              {data.departureAlerts.overdue.length === 0 && 
               data.departureAlerts.today.length === 0 && 
               data.departureAlerts.tomorrow.length === 0 ? (
                <div className="text-center text-sm text-[var(--color-text-muted)] py-6 border rounded-2xl bg-[var(--color-bg-surface)]">
                  No departures scheduled for today or tomorrow.
                </div>
              ) : (
                <>
                  {/* Overdue */}
                  {data.departureAlerts.overdue.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{b.guestName}</p>
                          <p className="text-xs text-gray-500">{b.roomName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          Overdue
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Today */}
                  {data.departureAlerts.today.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-2xl border border-yellow-200 bg-yellow-50/50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                          <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{b.guestName}</p>
                          <p className="text-xs text-gray-500">{b.roomName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                          Today
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Tomorrow */}
                  {data.departureAlerts.tomorrow.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-2xl border bg-[var(--color-bg-surface)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                          <CalendarDays className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{b.guestName}</p>
                          <p className="text-xs text-gray-500">{b.roomName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          Tomorrow
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>

        {/* Right Column (5 cols): AI Recommendations */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <AiRecommendationsCard recommendations={buildGuestHouseRecommendations(data)} />
        </div>
      </div>

      {/* ── Layer 3: Stock Intelligence ────────────────────────────────────────────── */}
      <section>
        <h2 className="font-bold text-sm text-[var(--color-text-primary)] mb-3">Stock Intelligence</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fast Moving */}
          <div className="rounded-2xl border bg-[var(--color-bg-surface)] overflow-hidden">
            <div className="bg-gray-50/50 px-4 py-3 border-b flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">Fast Moving (Last 7 Days)</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            {data.fastMovingStock.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">No consumption logged recently.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.fastMovingStock.map((item) => (
                  <div key={item.itemId} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 p-1.5 rounded-lg">
                        <Package className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                      {item.totalConsumed} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Almost Out */}
          <div className="rounded-2xl border bg-[var(--color-bg-surface)] overflow-hidden">
            <div className="bg-gray-50/50 px-4 py-3 border-b flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">Almost Out (Low Stock)</span>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            {data.lowStockItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">All stock levels are healthy.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.itemId} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-orange-50 p-1.5 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      </div>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                      {item.quantity} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Sheets */}
      <AddRoomSheet isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} />
      <AddGuestSheet isOpen={showAddGuest} onClose={() => setShowAddGuest(false)} />
    </div>
  );
}
