import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';
import { StatCard, type StatCardConfig } from '@/components/system/StatCard';
import DashboardKpiRows from '@/features/dashboard/DashboardKpiRows';
import { ISP_KPI_ROWS } from '@/features/dashboard/config/isp';
import { CHEMIST_KPI_ROWS } from '@/features/dashboard/config/chemist';
import { RESTAURANT_KPI_ROWS } from '@/features/dashboard/config/restaurant';
import { SCHOOL_KPI_ROWS } from '@/features/dashboard/config/school';
import { WHOLESALE_KPI_ROWS } from '@/features/dashboard/config/wholesale';
import { GUEST_HOUSE_KPI_ROWS } from '@/features/dashboard/config/guest-house';
import {
  RETAIL_KPI_ROWS,
  RETAIL_INVENTORY_ROWS,
} from '@/features/dashboard/config/retail';
import { STAFF_KPI_ROWS } from '@/features/dashboard/config/staff';
import type {
  ChemistDashboardData,
  DashboardData,
  GuestHouseDashboardData,
  RestaurantDashboardData,
  SchoolDashboardData,
  StaffDashboardData,
  WholesaleDashboardData,
} from '@/services/analytics.service';
import type { IspDashboardData } from '@/services/isp.service';

/**
 * KPI layout lab (overhaul Duty 1, Section 2.3/2.5).
 *
 * A dev-only, no-auth surface that renders every vertical's KPI arrangement
 * with synthetic *adversarial* data (zero, very large KES, high counts) inside
 * the exact dashboard content width (`max-w-lg`), so the shared cards can be
 * measured in a real browser at every Section 2.2 viewport - including the
 * card states (loading / empty / error) - without a seeded Clerk session.
 *
 * It is not part of the product UI: like `/gallery`, it 404s in production
 * unless `NEXT_PUBLIC_ENABLE_GALLERY=true`.
 */
export const dynamic = 'force-dynamic';

// The dashboard content column is `max-w-lg`; replicate it so measured widths
// match production rather than the full browser viewport.
const COLUMN = 'mx-auto w-full max-w-lg px-4';

function LabSection<T>({
  name,
  rows,
  large,
  zero,
}: {
  name: string;
  rows: StatCardConfig<T>[][];
  large: T;
  zero: T;
}) {
  return (
    <>
      <section
        data-testid="kpi-lab-section"
        data-vertical={name}
        data-scenario="large"
        className={COLUMN}
      >
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {name} - adversarial (large)
        </p>
        <DashboardKpiRows rows={rows} data={large} />
      </section>
      <section
        data-testid="kpi-lab-section"
        data-vertical={name}
        data-scenario="zero"
        className={COLUMN}
      >
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {name} - zero
        </p>
        <DashboardKpiRows rows={rows} data={zero} />
      </section>
    </>
  );
}

const ispLarge: IspDashboardData = {
  subscribers: { total: 12450, active: 12000, suspended: 400, churned: 50, activeRate: 96 },
  openTickets: 128,
  scheduledWorkOrders: 47,
  monthlyRevenue: 12450000,
};
const ispZero: IspDashboardData = {
  subscribers: { total: 0, active: 0, suspended: 0, churned: 0, activeRate: 0 },
  openTickets: 0,
  scheduledWorkOrders: 0,
  monthlyRevenue: 0,
};

const chemistLarge: ChemistDashboardData = {
  timeOfDay: 'morning',
  todaySales: 1250000,
  monthSales: 45750000,
  lowStockCount: 143,
  totalItems: 2450,
  expiringBatches: [],
  expiredBatches: [],
  topSellers: [],
  alerts: [],
};
const chemistZero: ChemistDashboardData = {
  timeOfDay: 'morning',
  todaySales: 0,
  monthSales: 0,
  lowStockCount: 0,
  totalItems: 0,
  expiringBatches: [],
  expiredBatches: [],
  topSellers: [],
  alerts: [],
};

const restaurantLarge: RestaurantDashboardData = {
  timeOfDay: 'evening',
  todayRevenue: 1250000,
  openOrdersCount: 128,
  openOrdersValue: 456000,
  paidOrdersToday: 342,
  openOrders: [],
  topMenuItems: [],
  alerts: [],
};
const restaurantZero: RestaurantDashboardData = {
  timeOfDay: 'evening',
  todayRevenue: 0,
  openOrdersCount: 0,
  openOrdersValue: 0,
  paidOrdersToday: 0,
  openOrders: [],
  topMenuItems: [],
  alerts: [],
};

const schoolLarge: SchoolDashboardData = {
  timeOfDay: 'morning',
  totalStudents: 2450,
  totalClasses: 84,
  activeTerm: { name: 'Term 1', dueDate: null },
  fees: {
    totalExpected: 12450000,
    totalCollected: 9875000,
    outstanding: 2575000,
    collectionRate: 79,
    paidCount: 1840,
    totalInvoices: 2450,
  },
  overdueInvoices: [],
  recentPayments: [],
};
const schoolZero: SchoolDashboardData = {
  timeOfDay: 'morning',
  totalStudents: 0,
  totalClasses: 0,
  activeTerm: { name: 'Term 1', dueDate: null },
  fees: {
    totalExpected: 0,
    totalCollected: 0,
    outstanding: 0,
    collectionRate: 0,
    paidCount: 0,
    totalInvoices: 0,
  },
  overdueInvoices: [],
  recentPayments: [],
};

const wholesaleLarge: WholesaleDashboardData = {
  timeOfDay: 'afternoon',
  todaySales: 1250000,
  monthSales: 45750000,
  totalOutstanding: 8950000,
  openCreditCount: 128,
  lowStockCount: 143,
  totalItems: 3200,
  topDebtors: [],
  topSellers: [],
  alerts: [],
};
const wholesaleZero: WholesaleDashboardData = {
  timeOfDay: 'afternoon',
  todaySales: 0,
  monthSales: 0,
  totalOutstanding: 0,
  openCreditCount: 0,
  lowStockCount: 0,
  totalItems: 0,
  topDebtors: [],
  topSellers: [],
  alerts: [],
};

const guestHouseLarge: GuestHouseDashboardData = {
  occupiedRooms: 120,
  totalRooms: 128,
  occupancyRate: 94,
  revenueThisMonth: 12450000,
  costThisMonth: 4560000,
  profitThisMonth: 7890000,
  outstandingBalance: 1250000,
  departureAlerts: { overdue: [], today: [], tomorrow: [] },
  fastMovingStock: [],
  lowStockItems: [],
};
const guestHouseZero: GuestHouseDashboardData = {
  occupiedRooms: 0,
  totalRooms: 0,
  occupancyRate: 0,
  revenueThisMonth: 0,
  costThisMonth: 0,
  profitThisMonth: 0,
  outstandingBalance: 0,
  departureAlerts: { overdue: [], today: [], tomorrow: [] },
  fastMovingStock: [],
  lowStockItems: [],
};

const retailLarge: DashboardData = {
  greeting: { timeOfDay: 'morning' },
  kpis: {
    todaySales: 12450000,
    salesTrendLabel: '+124%',
    salesTrendIsPositive: true,
    todayExpenses: 4560000,
    expensesTrendLabel: '-18%',
    expensesTrendIsNegative: true,
    lowStockCount: 143,
    lowStockLabel: '143 items low',
    profitEstimate: 7890000,
    profitTrendLabel: '+52%',
    profitTrendIsPositive: true,
  },
  attentionFeed: [],
  inventorySnapshot: {
    total: 3200,
    healthy: 2450,
    low: 600,
    outOfStock: 150,
    stockHealthPct: 77,
  },
  recommendedActions: [],
};
const retailZero: DashboardData = {
  greeting: { timeOfDay: 'morning' },
  kpis: {
    todaySales: 0,
    salesTrendLabel: '0%',
    salesTrendIsPositive: false,
    todayExpenses: 0,
    expensesTrendLabel: '0%',
    expensesTrendIsNegative: false,
    lowStockCount: 0,
    lowStockLabel: '0 items low',
    profitEstimate: 0,
    profitTrendLabel: '0%',
    profitTrendIsPositive: false,
  },
  attentionFeed: [],
  inventorySnapshot: { total: 0, healthy: 0, low: 0, outOfStock: 0, stockHealthPct: 0 },
  recommendedActions: [],
};

const staffLarge: StaffDashboardData = {
  greeting: { timeOfDay: 'morning' },
  kpis: {
    todaySalesCount: 1245,
    todaySalesTrend: 120,
    todaySalesTrendLabel: '+120',
    lowStockCount: 143,
    totalInventory: 3200,
    totalInventoryLabel: '3,200 items',
    tasksDoneToday: 128,
    tasksLabel: '128 done',
  },
  attentionFeed: [],
  lowStockWatchList: [],
  recommendedActions: [],
};
const staffZero: StaffDashboardData = {
  greeting: { timeOfDay: 'morning' },
  kpis: {
    todaySalesCount: 0,
    todaySalesTrend: 0,
    todaySalesTrendLabel: '0',
    lowStockCount: 0,
    totalInventory: 0,
    totalInventoryLabel: '0 items',
    tasksDoneToday: 0,
    tasksLabel: 'Nothing due',
  },
  attentionFeed: [],
  lowStockWatchList: [],
  recommendedActions: [],
};

export default function KpiLayoutLabPage() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_GALLERY !== 'true'
  ) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] pb-16 font-sans">
      <div className={`${COLUMN} py-8`}>
        <h1 className="text-lg font-black text-[var(--color-text-primary)]">
          KPI layout lab
        </h1>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Dev-only. Synthetic data only - no customer data. Each vertical is
          rendered at the real dashboard column width.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        <LabSection name="isp" rows={ISP_KPI_ROWS} large={ispLarge} zero={ispZero} />
        <LabSection
          name="chemist"
          rows={CHEMIST_KPI_ROWS}
          large={chemistLarge}
          zero={chemistZero}
        />
        <LabSection
          name="restaurant"
          rows={RESTAURANT_KPI_ROWS}
          large={restaurantLarge}
          zero={restaurantZero}
        />
        <LabSection
          name="school"
          rows={SCHOOL_KPI_ROWS}
          large={schoolLarge}
          zero={schoolZero}
        />
        <LabSection
          name="wholesale"
          rows={WHOLESALE_KPI_ROWS}
          large={wholesaleLarge}
          zero={wholesaleZero}
        />
        <LabSection
          name="guest-house"
          rows={GUEST_HOUSE_KPI_ROWS}
          large={guestHouseLarge}
          zero={guestHouseZero}
        />
        <LabSection
          name="retail"
          rows={RETAIL_KPI_ROWS}
          large={retailLarge}
          zero={retailZero}
        />
        <LabSection
          name="retail-inventory"
          rows={RETAIL_INVENTORY_ROWS}
          large={retailLarge}
          zero={retailZero}
        />
        <LabSection
          name="staff"
          rows={STAFF_KPI_ROWS}
          large={staffLarge}
          zero={staffZero}
        />

        <section
          data-testid="kpi-lab-section"
          data-vertical="states"
          data-scenario="states"
          className={COLUMN}
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            card states
          </p>
          <div className="grid grid-cols-1 gap-4">
            <StatCard label="Sample metric" icon={Package} value="KES 12,450,000" footnote="Loaded" />
            <StatCard label="Sample metric" icon={Package} value="" state="loading" />
            <StatCard label="Sample metric" icon={Package} value="" state="empty" />
            <StatCard label="Sample metric" icon={Package} value="" state="error" />
          </div>
        </section>
      </div>
    </div>
  );
}
