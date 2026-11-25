# HisaFlow Metrics Dictionary (Phase A)

> Single source of truth for every number, series bucket, and comparison displayed across vertical dashboards and finance views.

---

## Global Conventions

- **Timezone:** `Africa/Nairobi` (`EAT`, fixed `UTC+03:00`). All calendar day, week, and month boundaries are computed in EAT, never host OS local time or raw UTC.
- **Week Definition:** Calendar week starts **Monday 00:00:00+03:00** and ends **Sunday 23:59:59.999+03:00** (ISO-8601 week). Rolling `7d` covers `[todayStartEAT - 6 days, now]` (7 calendar days inclusive).
- **Zero-Filled Series Invariant:** Every time-series response generates the complete bucket sequence on the server (hourly for single-day ranges; daily for `7d` / `week` / `month` / `30d`; monthly for `year`) and asserts `total === sum(buckets)`.
- **Comparison Rule:** When `previousTotal === 0`, `deltaPct` is `null` and `comparisonStatus` is `'no_previous_data'` (rendered cleanly as `"No activity in previous period"` rather than `"+100%"` or `Infinity`). Current in-progress ranges set `partialPeriod: true`.
- **Money Precision:** Arithmetic uses `roundMoney(val)` (2 decimal places) with Prisma `Decimal` converted consistently; display formatting rounds only on output.

---

## Core & Vertical Metric Definitions

| Metric ID | Vertical | Meaning | Source Table(s) & Status Filter | Valuation Basis | Timestamp & TZ | Additive? |
|---|---|---|---|---|---|---|
| `retail.sales.revenue` | Retail, Chemist, Wholesale | Gross value of goods sold | `inventory_transactions` where `type = 'SALE'` (excluding child ingredient rows with composite parent) | `ABS(quantity_change) * COALESCE(metadata.appliedTierPrice, item.selling_price, 0)` | `created_at` in `Africa/Nairobi` | Yes |
| `retail.purchases.spend` | Retail | Value of stock received | `inventory_transactions` where `type = 'PURCHASE'` | `ABS(quantity_change) * COALESCE(item.cost_price, 0)` | `created_at` in `Africa/Nairobi` | Yes |
| `retail.profit.estimate` | Retail | Estimated gross profit on inventory flows | Derived: `retail.sales.revenue - retail.purchases.spend` (period view) / Finance P&L (`revenue - cogs - operating_expenses`) | Recorded prices / cost price | `created_at` in `Africa/Nairobi` | Yes |
| `retail.stock.health` | Retail, Chemist, Wholesale | Active inventory items in healthy vs low vs out-of-stock state | `inventory_items` where `is_active = true` | `healthy`: `qty > threshold * 1.5`; `low`: `0 < qty <= threshold`; `outOfStock`: `qty === 0` | Snapshot at request time | No (point-in-time) |
| `restaurant.sales.revenue` | Restaurant | Dining & counter sales revenue | Paid `table_orders` (`status = 'PAID'`) summing `table_order_items (quantity * unit_price)` **plus** direct non-table `inventory_transactions` (`type = 'SALE'`, `reason NOT LIKE 'Table order %'`, excluding raw ingredient deduction rows when composite dish is priced via `metadata.unitPrice` / `selling_price`) | `table_order_items.quantity * unit_price` or sale item price | `closed_at` (TableOrder) / `created_at` (direct SALE) in `Africa/Nairobi` | Yes |
| `restaurant.orders.pending` | Restaurant | Open unpaid dining tabs | `table_orders` where `status = 'OPEN'` | Count & `SUM(quantity * unit_price)` | Snapshot | No |
| `guesthouse.occupancy` | Guest House | Rooms currently checked in vs active rooms | `bookings` (`status = 'CHECKED_IN'`) / `rooms` (`is_active = true` & `status != 'MAINTENANCE'`) | `occupiedRooms / totalRooms * 100` | Snapshot (7-day historical buckets check booking `[checkInDate, checkOutDate]` vs EAT day, excluding `CANCELLED`) | No |
| `guesthouse.revenue` | Guest House | Collected guest revenue in period | `payments` linked to `invoices` with `booking_id IS NOT NULL` (`status != 'VOIDED'`) — fallback to `invoice.amount_paid` anchored to period if legacy unpaymented invoice exists; aligned with `FinanceBreakdownService` (`Payment.recordedAt`) | `Payment.amount` (or `amountPaid`) | `recorded_at` (EAT) | Yes |
| `guesthouse.outstanding` | Guest House | Unpaid balance on open folios | `invoices` where `status NOT IN ('PAID', 'VOIDED')` | `MAX(0, room_total + consumption_total + adjustments_total - amount_paid)` | Snapshot | No |
| `wholesale.credit.outstanding` | Wholesale | Total unpaid customer credit across **all** open accounts (never `take: 5` truncated) | `credit_records` where `status IN ('UNPAID', 'PARTIAL')` | `SUM(amount_total - amount_paid)` across full result set | Snapshot | No |
| `isp.revenue` | ISP | Collected subscriber payments in period (with invoice-paid fallback matching) | `payments` joined to `invoices` (`subscriber_id IS NOT NULL`, `status != 'VOIDED'`) | `SUM(payment.amount)` | `recorded_at` in `Africa/Nairobi` | Yes |
| `isp.subscribers` | ISP | Active, suspended, churned subscriber fleet | `subscribers` grouped by `status` | Counts & `active / total * 100` | Snapshot | No |
| `isp.tickets.open` / `isp.work_orders.scheduled` | ISP | Open support tickets & scheduled dispatches | `tickets` (`status = 'OPEN'`), `work_orders` (`status = 'SCHEDULED'`) + 7-day daily creation counts | Counts | `created_at` (series) / Snapshot | Mixed |
| `school.fees` | School | Term expected, collected, outstanding & collection rate | `fee_invoices` (`status != 'VOIDED'`); recent/daily payments from `fee_payments` | `expected = total_expected - adjustments_total`; `collected = SUM(amount_paid)` | Snapshot (`fee_invoices`) + `recorded_at` in EAT (`fee_payments`) | `fee_payments` Yes; `fee_invoices` No |

---

## Open Decisions (Brief Section 8 — Adopted Safe Defaults)

1. **What counts as a sale?** Only confirmed/settled sales (`InventoryTransaction.type = 'SALE'`, `TableOrder.status = 'PAID'`, `Invoice.status IN ('PAID', 'PARTIAL')` payments); `DRAFT`, `VOIDED`, `CANCELLED` orders/invoices and unapproved assistant proposals are excluded.
2. **Revenue basis:** Cash/recorded sale & collected payments (`Payment.amount` for Guest House/ISP/School; `quantity * effectiveSellingPrice` for Retail/Chemist/Wholesale; `TableOrderItem` + counter sales for Restaurant).
3. **Timezone:** Fixed `Africa/Nairobi` (`UTC+3`) across all backend and frontend bucketing.
4. **Week definition:** Monday-start calendar week for `'week'`/`'last_week'`; rolling 7 EAT days (`[today-6, today]`) for `'7d'`.
5. **Stock valuation:** Cost basis (`quantity * costPrice`) for inventory asset value; `sellingPrice` for potential retail value (per existing `FinanceService`).
6. **Comparison when previous period is zero:** `deltaPct: null`, display `"No prior activity"` instead of `"+100%"`.
