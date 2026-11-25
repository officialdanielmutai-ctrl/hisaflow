# HisaFlow Data Integrity Diagnosis (Phase 0)

> Root-cause investigation of dashboard data integrity issues per `hisaflow-data-integrity-brief.md` Section 3.

---

## 1. Zero-Sales-Week Reproduction & Root Cause Trace

When an organisation has **zero sales, zero expenses, and zero activity** in a week (or selected period):
1. On **Retail Desktop** (`apps/frontend/app/(dashboard)/dashboard/page.tsx`):
   - `<BentoStatisticsCard />` receives a hardcoded `tab1Bars` literal (`Mon: 40% .. Sat: +95% .. Sun: 60%`), displaying active bar columns despite `data.kpis.todaySales === 0`.
   - `<ModernAnalyticsChart />` is rendered with **no `data` prop**, so React defaults to `DEFAULT_DATA` (`Mon: KES 42,000 .. Thu: KES 145,000 .. Sun: KES 53,000`) plus a hardcoded `+17.8% peak` badge.
   - `<BentoSalesPair />` falls back to `+22%` / `+8%` trends when `%` labels are missing, and `BentoGrowthCard` falls back to `100%` / `+12%` / `75%` and offers 4 timeframe buttons that do not re-query anything.
2. On **Chemist Desktop** (`ChemistDashboard.tsx`):
   - `tab1Bars` is hardcoded `Mon: 35% .. Sat: +92%`, `BentoGrowthCard` hardcodes `footerRightLabel="KES 12,500 dispensed today"` regardless of actual sales, and `BentoSalesPair` hardcodes `+18%` / `+24%`.
3. On **Restaurant Desktop** (`RestaurantDashboard.tsx`):
   - When `topMenuItems` has fewer than 7 entries (e.g. `[]` on a zero-sales org), lines 109–115 fall back to `(data.paidOrdersToday || 12) * ratio` — literally displaying up to 11 orders on a day with 0 orders.
4. On **Guest House Desktop** (`GuestHouseDashboard.tsx`):
   - `secondaryBars` computes fake Mon–Sun daily revenue `(data.revenueThisMonth / 30) * ratio * 1.5` instead of actual daily payments/revenue.
5. On **Wholesale Desktop** (`WholesaleDashboard.tsx`):
   - `wholesaleTab1Bars` pads missing `topSellers` slots with `todaySales * ratio`, and hardcodes `+16%` / `+22%`.
6. On **All 7 Mobile Verticals** (`features/dashboard/config/*.ts`):
   - Even when `todaySales > 0` comes from a single sale today (and 0 on prior 6 days), `sparklineData` synthesizes a 7-day zig-zag curve by multiplying today's scalar by `[0, 0.38, 0.60, 0.52, 0.75, 0.88, 1]`, misrepresenting single-day totals as a multi-day trend. Hardcoded deltas (`+15%`, `+14%`, `-6%`, `+18%`, `+12%`, `+16%`, `+21%`, `+8%`) appear unconditionally whenever data loads.

---

## 2. Hypothesis Verdicts (H1–H12)

| # | Hypothesis | Verdict | Code Evidence |
|---|---|---|---|
| **H1** | Placeholder, fallback or fabricated values in components | **CONFIRMED** | `ModernAnalyticsChart.tsx` (`DEFAULT_DATA` + `+17.8% peak`); `BentoStatisticsCard.tsx` (`DEFAULT_TAB1_BARS`, `+76%`); `BentoActivityFeed.tsx` (`DEFAULT_ORDERS`); `dashboard/page.tsx` Retail `tab1Bars`; `ChemistDashboard.tsx` (`"KES 12,500 dispensed today"`, `tab1Bars`, `+18%`/`+24%`); `RestaurantDashboard.tsx` (`paidOrdersToday \|\| 12`); `GuestHouseDashboard.tsx` (`secondaryBars` `(revenueThisMonth/30)*ratio`); `WholesaleDashboard.tsx`, `IspDashboard.tsx`, `SchoolDashboard.tsx` hardcoded deltas; all 7 `features/dashboard/config/*.ts` fabricated sparklines & deltas. |
| **H2** | Interpolation or smoothing in charts | **CONFIRMED** | `StatCard.tsx` `buildFinancePath()` uses monotone cubic spline interpolation with soft area fill; `RevenueChart.tsx` uses `type="monotone"`. Switching to exact straight line segments / `type="linear"` prevents curve overshoot across zero/sparse buckets. |
| **H3** | Wrong records counted as sales | **CONFIRMED** | `TransactionsService.create()` writes negative `InventoryTransaction(SALE)` rows for **ingredients** when selling composite Restaurant dishes (and `0` on the composite dish), so `VerticalAnalyticsService.getRestaurantDashboard()` sums ingredient prices (or `0`) instead of `TableOrderItem` / dish revenue. |
| **H4** | Wrong time bucketing (UTC vs EAT & week bounds) | **CONFIRMED** | `AnalyticsService` (`getDashboardSummary`, `getStaffDashboardSummary`, `getRecommendedActions`), `VerticalAnalyticsService` (`getChemistDashboard`, `getRestaurantDashboard`, `getWholesaleDashboard`), `IspController.getDashboard()`, and `FinanceService`/`FinanceBreakdownService` use OS local `new Date(y, m, d)` or `.toISOString().slice(0,10)` (UTC), mis-bucketing Kenyan EAT (`Africa/Nairobi`, `UTC+3`) sales between `00:00–02:59 EAT` and `21:00–23:59 UTC`. |
| **H5** | Client-side aggregation of incomplete data | **CONFIRMED** | `VerticalAnalyticsService.getWholesaleDashboard()` puts `take: 5` on `creditRecord.findMany` and sums `totalOutstanding` over only those 5 rows! `GuestHouseDashboard.tsx` loops over client-fetched bookings using local clock time `d` instead of server EAT buckets. |
| **H6** | Duplicate counting in queries | **CONFIRMED (Composite Restaurant)** | Composite sales create `N` ingredient `InventoryTransaction(SALE)` rows plus 1 parent row, skewing item-transaction counts/revenue when queried flatly without filtering composite children. |
| **H7** | Stale or mismatched caches | **CONFIRMED** | `SWRProvider.tsx` globally enables `keepPreviousData: true`, showing stale numbers across range/org switches; `OrganizationProvider` does not purge SWR cache on org switch or logout; `sw.ts` uses `defaultCache` without bypassing authenticated analytics routes. |
| **H8** | Toggle not wired or racing | **CONFIRMED** | `RetailDashboard` includes `preset` in SWR key `['dashboard', orgId, preset]` while `getDashboardData(token, orgId)` ignores `preset`; `BentoGrowthCard` (`24h/12h/week/month`) and `BentoStatisticsCard` (`Weekly/Monthly`) pills only toggle local state. |
| **H9** | Inconsistent definitions between cards | **CONFIRMED** | Guest House revenue on dashboard uses checkout-anchored `invoice.amountPaid` while `/finance` uses payment-date `Payment.amount`; ISP dashboard sums `invoice.adjustmentsTotal` on `PAID` invoices while `/finance` sums `Payment.amount`; `TransactionsService` records `appliedTierPrice` in metadata while analytics ignores it and uses `item.sellingPrice`. |
| **H10** | Numeric handling & zero-baseline percentage bugs | **CONFIRMED** | Repeated `Number(Decimal)` floating-point arithmetic; `AnalyticsService` returns `salesTrendPct = 100` (`+100%`) when `yesterdaySales === 0 && todaySales > 0` instead of distinguishing `"no sales in previous period"`. |
| **H11** | Offline and optimistic data | **REJECTED** | No offline mutation queue creates optimistic sales records; `app/sw.ts` handles push notifications and Serwist precaching only (though API routes must be excluded from stale runtime caching). |
| **H12** | Pre-aggregated tables out of date | **PARTIALLY CONFIRMED** | No separate KPI summary tables exist, except `Invoice` cached columns (`adjustmentsTotal`, `amountPaid`) which depend on atomic updates in invoice/tax services. |

---

## 3. Prioritized Fix Order

1. **Phase A (Contracts & Dictionary):** Define `docs/metrics-dictionary.md` and shared types in `packages/types/src/index.ts`.
2. **Phase B (Backend Timezone, Integrity & Zero-Filled Series):**
   - Create `apps/backend/src/modules/analytics/time-buckets.ts` enforcing `Africa/Nairobi` (`UTC+3`), Monday-start ISO weeks, exact preset resolution, integer minor-unit/2dp rounding, zero-filled series generation, and `total === sum(buckets)` assertion helper.
   - Fix `AnalyticsService`, `VerticalAnalyticsService` (Wholesale full credit sum, Restaurant `TableOrder` + composite pricing, Chemist/Wholesale/Restaurant EAT bounds), `IspController` (EAT month bounds + payment/invoice revenue), and `FinanceService`/`FinanceBreakdownService` (EAT bucketing & `appliedTierPrice` support).
   - Expose timeframe-aware queries (`preset`, `from`, `to`) and server-generated zero-filled daily/hourly series + honest previous-period comparisons (`comparison.deltaPct: number | null`).
3. **Phase C & D (Frontend Data Wiring, Purge Fabrications, Toggles & Cache Hygiene):**
   - Purge `DEFAULT_DATA`, `DEFAULT_TAB1_BARS`, `DEFAULT_TAB2_BARS`, `DEFAULT_ORDERS`, hardcoded percentages/labels, and all single-scalar sparkline multipliers across all 7 verticals.
   - Wire `ModernAnalyticsChart`, `BentoSalesPair`, `BentoGrowthCard`, `BentoStatisticsCard`, `BentoActivityFeed`, and `StatCard` (mobile & desktop) strictly to server-returned series, metrics, and explicit empty/zero/loading/error/freshness states.
   - Replace spline curve overshoot in `StatCard` and `RevenueChart` with exact straight segments.
   - Disable `keepPreviousData` across range/org transitions, clear SWR cache on org switch/sign-out, and enforce `NetworkOnly` for API routes in `app/sw.ts`.
4. **Phase E & F (Reconciliation Suite & Guardrails):**
   - Add repeatable audit script / backend reconciliation suite verifying `total === sum(buckets)`, zero-sales Org Z, EAT `23:59` / `00:01` & `22:00 UTC` boundaries, Wholesale >5 credits, Restaurant composite orders, multi-org isolation, and frontend guard tests banning hardcoded chart arrays & single-scalar sparkline fabrication.
