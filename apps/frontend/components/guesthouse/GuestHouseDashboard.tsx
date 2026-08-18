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
import { AddRoomSheet } from './AddRoomSheet';
import { AddGuestSheet } from './AddGuestSheet';
import { AiRecommendationsCard, type Recommendation } from '@/components/shared/AiRecommendationsCard';

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

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Good {timeOfDay}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {membership?.organization.name}
          </p>
        </div>
      </div>

      {/* ── Layer 2: Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Link 
          href="/bookings/new"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <CalendarDays className="h-6 w-6 mb-2" />
          <span className="text-xs font-bold text-center leading-tight">New Booking</span>
        </Link>
        <button
          onClick={() => setShowAddGuest(true)}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Users className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Add Guest</span>
        </button>
        <button
          onClick={() => setShowAddRoom(true)}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Bed className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Add Room</span>
        </button>
      </div>

      {/* ── Layer 1: KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/rooms" className="flex flex-col rounded-2xl bg-[var(--color-bg-surface)] border hover:bg-[var(--color-bg-base)] transition-colors p-4">
          <div className="flex items-center justify-between mb-2">
            <Bed className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              {data.occupancyRate}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Occupied Rooms</p>
          <p className="font-bold text-lg">{data.occupiedRooms} <span className="text-sm font-normal text-gray-500">/ {data.totalRooms}</span></p>
        </Link>

        <Link href="/finance" className="flex flex-col rounded-2xl bg-[var(--color-bg-surface)] border hover:bg-[var(--color-bg-base)] transition-colors p-4">
          <TrendingUp className="h-5 w-5 text-green-600 mb-2" />
          <p className="text-xs text-muted-foreground">Revenue (MTD)</p>
          <p className="font-bold text-lg">KES {data.revenueThisMonth.toLocaleString()}</p>
        </Link>

        <Link href="/finance" className="flex flex-col rounded-2xl bg-[var(--color-bg-surface)] border hover:bg-[var(--color-bg-base)] transition-colors p-4">
          <TrendingUp className="h-5 w-5 text-[var(--color-primary)] mb-2" />
          <p className="text-xs text-muted-foreground">Profit Est (MTD)</p>
          <p className={`font-bold text-lg ${data.profitThisMonth >= 0 ? 'text-[var(--color-primary)]' : 'text-red-500'}`}>
            KES {data.profitThisMonth.toLocaleString()}
          </p>
        </Link>

        <Link href="/finance" className="flex flex-col rounded-2xl bg-[var(--color-bg-surface)] border hover:bg-[var(--color-bg-base)] transition-colors p-4">
          <AlertTriangle className={`h-5 w-5 mb-2 ${data.outstandingBalance > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className={`font-bold text-lg ${data.outstandingBalance > 0 ? 'text-red-500' : 'text-gray-900'}`}>
            KES {data.outstandingBalance.toLocaleString()}
          </p>
        </Link>
      </div>

      {/* AI Recommendations */}
      <AiRecommendationsCard recommendations={buildGuestHouseRecommendations(data)} />

      {/* ── Layer 2: Departures ────────────────────────────────────────────────────── */}
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
