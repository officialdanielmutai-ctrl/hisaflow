# HisaFlow Data Integrity Brief — Every Number and Chart Must Match the Backend

**Read first:** `hisaflow-agent-ground-rules.md` (Part 1). Every rule in it applies to every phase here: required reading, non-regression discipline, lint/type-check/CI gates, tooling, Definition of Done, and backend-before-frontend ordering (with frontend prompts drafted early).

**Status of this document:** it was written from a user report, not from reading the code. Every statement about *why* a number is wrong is a hypothesis. **Phase 0 exists to find the real causes with evidence before any fix is written.** Do not skip it.

---

## 1. The problem

Some cards, numbers and charts in the vertical dashboards do not match what is in the backend. Example reported: a week in which no sales were made or reported still shows a visual and numbers suggesting sales happened. It is not believed to be deliberate mock data. It looks like the frontend is not faithfully representing backend records. The same must hold when the user changes the timeframe toggles: every number and chart must change to reflect exactly what the backend holds for that range, and nothing else.

### The standard every visual must meet

1. **Truthful.** Every displayed value is derived from real records in the backend for the current organisation, the selected vertical, and the selected range. No fabricated, smoothed, interpolated, cached-from-elsewhere, or default-filled values presented as data.
2. **Traceable.** For any number on screen, an engineer can name the endpoint, the query, the filters, and the definition behind it.
3. **Reconciled.** The headline total equals the sum of the chart buckets, equals an independent query against the database, and equals what other cards show for the same metric.
4. **Honest about uncertainty.** Zero, empty, loading, stale, partial and failed states each look different and are never disguised as normal data.
5. **Faithful to the toggle.** Changing the timeframe re-queries the backend. The screen never shows a mix of old and new ranges, and the visible label states the exact range.

---

## 2. Hypotheses to test in Phase 0

Treat each as a suspect, not a conclusion. For each, record *confirmed / rejected / inconclusive* with evidence.

| # | Suspect | What it would look like |
|---|---|---|
| H1 | Placeholder, fallback or fabricated values in components | Hard-coded arrays, `Math.random`, "demo" or seed datasets, default chart data used when the API returns empty or errors, sparklines generated from a single value |
| H2 | Interpolation or smoothing in charts | Chart library "curve", `connectNulls`, area fill, or a helper that fills gaps with neighbouring values instead of zeros |
| H3 | Wrong records counted as sales | Draft, cancelled, voided, refunded, unpaid or test records included; quotations or assistant proposals counted; soft-deleted rows included; seeded demo organisation data visible to real organisations |
| H4 | Wrong time bucketing | Day boundaries computed in UTC while users are in Kenya (UTC+3), so late-evening sales land on the next day; "this week" defined differently on the client and the server (rolling 7 days vs calendar week, Monday vs Sunday start) |
| H5 | Client-side aggregation of incomplete data | Summing a paginated or limited list (first page only), `take`/`limit` defaults, or filtering after truncation |
| H6 | Duplicate counting in queries | Joins that multiply rows (invoice with several lines or payments), `SUM` over a joined set, counting rows instead of distinct invoices |
| H7 | Stale or mismatched caches | Query keys that omit organisation, range or granularity; Redis cache keys missing the range; a service worker or HTTP cache serving old authenticated responses; local storage persisting data across organisation switch or logout |
| H8 | Toggle not wired or racing | The toggle changes UI state but not the request; out-of-order responses overwrite newer ones; previous-range data kept on screen while the new range loads |
| H9 | Inconsistent definitions between cards | "Sales" on one card means invoices, on another payments, on another inventory transactions of type sale |
| H10 | Numeric handling | Decimal values serialised as strings and summed as text, floating-point rounding, currency formatting that hides decimals or rounds before summing |
| H11 | Offline and optimistic data | Unsynced offline sales or optimistic UI updates counted as real records and never reconciled |
| H12 | Pre-aggregated tables out of date | Materialised summaries or cached daily totals that are not refreshed or rebuilt after edits, voids, or backdated entries |

---

## 3. Phase 0 — Inventory and audit (no behaviour changes)

**Scope:** read, instrument, reproduce, report. Only add tests, scripts and logging.

1. **Visual inventory.** For every vertical frontend (retail/inventory, guest house, ISP, and any other), list every card, number, chart, table total, badge and progress indicator. Produce `docs/data-integrity-inventory.md` with one row per visual:

   | Vertical | Screen | Component | Displays | Endpoint / hook | Query or service function | Filters applied | Transformations on the client | Range toggle? | Verdict |
   |---|---|---|---|---|---|---|---|---|---|

   Verdict is one of: **faithful**, **suspect**, **fabricated/fallback**, **unknown**. Include file paths.
2. **Find every non-data source.** Search the frontend for hard-coded numeric arrays in chart or card components, `Math.random`, "mock", "demo", "sample", "placeholder", "fallback", `|| []` and `?? 0` patterns feeding charts, `keepPreviousData` / `placeholderData` usage, interpolation or curve settings, and any helper that fills missing days. List each with the reason it exists.
3. **Reproduce the reported case.** Create a test organisation with **zero** sales in a chosen week. Capture exactly what each sales-related card and chart shows for that week, the network responses behind them, and the raw database rows. Identify the first place the data stops matching.
4. **Build the audit script.** A repeatable script (run against a test organisation only, never production data) that, for each inventoried visual, fetches what the UI would display and compares it to an independent SQL query written for the audit. Output a pass/fail table per visual and range.
5. **Check each hypothesis H1–H12** and record the verdict with evidence.
6. **Deliver `docs/data-integrity-diagnosis.md`:** root cause per discrepancy, the list of visuals that are not faithful, and a recommended fix order. **Wait for review before Phase B onward.**

**Done when:** every visual in the inventory has a verdict, the reported case is reproduced with a traced root cause (or a clear statement of what was tried), and the audit script runs.

---

## 4. Target design

### 4.1 One source of truth per metric

A **metrics dictionary** (`docs/metrics-dictionary.md`, plus a typed definition in code) defines every number the product shows:

- Name, vertical, and plain-language meaning.
- The exact source table(s) and **which statuses count** (for example, which invoice or transaction statuses count as a sale; how voids and refunds are treated).
- Basis for amounts (recorded total vs paid amount; tax included or excluded; currency and unit, with money handled as exact decimals or minor units).
- Time basis (which timestamp: created, issued, paid, check-in) and the **timezone rule**.
- Grain options (hour, day, week, month) and how a "week" is defined.
- Whether it is additive across buckets (revenue, count) or not (occupancy rate, active subscribers at a point in time, stock level).

No visual may invent its own definition. Two cards that show the same concept use the same definition and the same endpoint.

### 4.2 Aggregate on the server, render on the client

All sums, counts, groupings and bucketing happen in the backend in SQL (or equivalent) inside the database, scoped by the authenticated organisation. The frontend only formats and draws. Suggested response contract (adapt names to repo conventions):

```json
{
  "metric": "sales.revenue",
  "range": { "from": "2026-11-23T00:00:00+03:00", "to": "2026-11-29T23:59:59+03:00", "tz": "Africa/Nairobi", "granularity": "day" },
  "total": "0.00",
  "currency": "KES",
  "buckets": [ { "start": "2026-11-23T00:00:00+03:00", "value": "0.00", "count": 0 } ],
  "comparison": { "range": { "from": "...", "to": "..." }, "total": "0.00" },
  "meta": { "generatedAt": "...", "rowCount": 0, "partialPeriod": true }
}
```

Rules:
- **Zero-filled buckets come from the server** (for example, generating the full series of buckets and left-joining the data), so a day with no sales is an explicit zero. The client never invents missing buckets.
- **`total` equals the sum of `buckets`** and the endpoint asserts this in tests.
- Amounts are strings (exact decimals) or integers in minor units. No floating-point sums.
- The response always echoes the range it actually used, so the UI can show it and detect a mismatch.

### 4.3 Frontend rules

- **No data in components.** Charts and cards render only what the API returned. Ban hard-coded datasets, `Math.random`, and fallback arrays in chart or card code. Enforce with an ESLint rule or a CI check.
- **Distinct states**, each visually different: loading (skeleton, no old numbers shown as current), empty ("No sales in this period", with the range), zero value (a real 0 shown as 0), error (message and retry, no numbers), stale (data older than a threshold, with an "updated at" stamp), partial period (current day/week/month flagged as in progress).
- **No smoothing or interpolation** in charts. Use straight or step rendering with true points, no `connectNulls`, no area fill implying continuity across gaps.
- **Query keys include everything that changes the data:** organisation, vertical, metric, range, granularity, timezone, and comparison setting. Cancel or ignore responses that do not match the currently requested range.
- **While a new range loads, do not leave the old range's numbers on screen as if they belong to the new one.** Either show a skeleton, or keep the old data visibly marked as stale and outdated.
- **Central formatting.** One helper formats money, counts and percentages. Rounding happens only at display time, never before summing.
- **Clear all cached data on logout and organisation switch** (query cache, local storage, session storage, IndexedDB).

### 4.4 Caching rules

- Server caches (Redis or in-memory) must key on organisation, metric, range, granularity and timezone, with a short TTL and explicit invalidation when relevant records change (sale created, voided or refunded; booking changed; subscriber renewed).
- The PWA service worker must not serve stale authenticated API aggregates as truth. Use network-first for dashboard endpoints, with a clearly labelled offline fallback ("last updated 10:42, you are offline").
- Pre-aggregated tables, if any exist, need a defined refresh path and a rebuild script, and must be covered by the reconciliation tests.

---

## 5. Phases

Each phase has a Backend and a Frontend part. Per ground rule 1.6, draft the frontend prompt early and issue it as soon as the API contract is stable.

### Phase A — Metrics dictionary and contract (decisions first)

**Backend**
- Write the metrics dictionary for every number in the inventory. For each ambiguous definition, propose a default and list it under "Open decisions" (section 8) for the owner to confirm. Do not guess silently.
- Define the shared TypeScript types and validation schema for the response contract in a shared package, so backend and frontend cannot drift.

**Frontend:** none, except aligning the inventory with metric names.

**Done when:** every inventoried visual maps to a metric in the dictionary, and the contract types compile in both apps.

### Phase B — Backend aggregation endpoints

**Backend**
1. One aggregation service per metric family per vertical, called by thin endpoints. All queries scoped by authenticated organisation (never an ID supplied by the client), with soft-deleted and test/demo records excluded according to the dictionary.
2. Bucketing in the organisation's timezone (default Africa/Nairobi, confirm in decisions), with `date_trunc` or equivalent after converting timestamps to that zone. Test the boundary cases: a record at 23:59 and 00:00 local time, and a record at 22:00 UTC.
3. Zero-filled series generated in the database or in one well-tested helper.
4. Avoid duplicate counting: aggregate line items and payments in separate subqueries or use `COUNT(DISTINCT …)` where appropriate, and add tests with multi-line and multi-payment records.
5. Pagination must never affect totals: aggregates are computed over the whole range, not over a page.
6. Add or verify indexes for the (organisation, timestamp, status) access patterns, and check query plans for the heaviest endpoints.
7. Add correct cache keys and invalidation (section 4.4).
8. Keep old endpoints working until the frontend migrates. New endpoints are additive.

**Frontend:** none yet, except typed client stubs against the contract.

**Done when:** for each endpoint, a fixture-based test proves `total == sum(buckets) ==` an independent SQL result, boundary and duplicate-counting tests pass, and cross-organisation requests return nothing.

### Phase C — Frontend data layer

**Frontend**
1. A typed API client and hooks for the new endpoints, with query keys as in section 4.3.
2. Remove every fabricated or fallback data source found in Phase 0. If a component needs sample data for development or Storybook, keep it in test/dev tooling only and make production builds fail if it is imported.
3. Implement the distinct states (loading, empty, zero, error, stale, partial period).
4. Replace chart settings that smooth or interpolate.
5. Race protection: ignore or cancel responses for superseded ranges.
6. Cache clearing on logout and organisation switch. Service-worker rules from section 4.4.
7. Central formatting helper adopted everywhere numbers are displayed.

**Backend:** support for any contract gaps the frontend finds (record them as issues, not silent workarounds).

**Done when:** the reported case (a zero-sales week) displays an honest empty or zero state on every sales card and chart, and no hard-coded or fallback data remains in the dashboards.

### Phase D — Timeframe toggles

**Backend and Frontend**
1. Define each preset precisely and identically on both sides, using the shared helper: Today, Yesterday, This week, Last week, This month, Last month, Last 7 days, Last 30 days, Custom. State whether "week" starts Monday or Sunday (see decisions).
2. The toggle triggers a new request with explicit `from`, `to`, `granularity`, and timezone. The UI shows the resolved range in plain text ("23 Nov – 29 Nov 2026").
3. Pick granularity from the range by a fixed rule (for example, hourly for a day, daily up to about 31 days, weekly or monthly beyond), and use the same rule on server and client.
4. **Comparison against the previous period:** when the previous total is zero, do not show a percentage (avoid "+100%" or infinity). Show a clear label such as "no sales in previous period". Current in-progress periods are labelled as partial and compared fairly or not compared.
5. Every toggle change is covered by an end-to-end test that checks the displayed numbers against the fixture's known values for that range.

**Done when:** for every preset and a custom range, on every vertical, the screen matches the fixture's expected numbers, switching quickly between ranges never leaves mismatched data on screen, and the displayed range label always matches the data.

### Phase E — Vertical-by-vertical pass

Take each vertical in turn and verify every visual in the inventory against the dictionary. Use the vertical scope docs as the source of truth, and complete the list below from the repo. Items that are easy to get wrong:

| Vertical | Metrics to check carefully |
|---|---|
| Retail / inventory | Sales count and revenue (which statuses count; voids/refunds), gross profit (cost basis), stock quantity and stock value (quantity × cost, or price? per the dictionary), low-stock counts (threshold source), top products (ranking by quantity or revenue), sales by payment method |
| Guest house | Occupancy rate (denominator excludes out-of-service rooms; counts nights, not bookings), bookings count by check-in vs creation date, revenue recognised vs deposits, average daily rate, check-ins/check-outs today |
| ISP | Active subscribers (point-in-time definition, expiry boundaries), monthly recurring revenue, renewals due and overdue, new vs churned subscribers per period, router action failures |
| All | Any "today" widget, any badge counts in navigation, any export or report totals |

For each vertical, deliver: the updated inventory table (all rows faithful), the fixtures used, and the test list.

**Done when:** the audit script reports all visuals for that vertical as passing across all presets.

### Phase F — Guardrails so this never regresses

1. **Reconciliation test suite in CI:** fixtures with known answers (including zero-sales, single-sale, boundary-time, voided/refunded, multi-line, multi-payment, and multi-organisation cases) checked against every endpoint and, through end-to-end tests, against the rendered numbers.
2. **Lint/CI rules** that fail the build on hard-coded datasets in chart/card components, `Math.random` in the UI source, unapproved smoothing options, and direct arithmetic on money values outside the shared helpers.
3. **Runtime integrity checks in development and staging:** warn loudly when a response's `total` differs from the sum of buckets, when the returned range differs from the requested range, or when a bucket is missing.
4. **Freshness indicator:** a small "updated at" stamp on each dashboard card or on the page.
5. **Admin reconcile endpoint or script** that recomputes a metric directly from raw records and compares it to what the dashboard endpoint returns, for investigating future reports.
6. **A short "how to add a metric" checklist** in the repo: add the dictionary entry, the aggregation, the contract test, the fixture, then the UI.

**Done when:** all of the above run in CI, and a deliberate injection of a wrong number (for example, a hard-coded value or a wrong status filter) is caught by at least one automated check.

---

## 6. Test fixtures (create in Phase 0, extend through Phase F)

- **Org Z:** no records at all. Every card shows an honest empty/zero state in every range.
- **Org A (retail):** a week with sales on only some days; at least one voided and one refunded sale; a multi-line invoice; a sale at 23:59 local time and one at 00:01 local time; a record at 22:00 UTC; a previous period with zero sales and another with sales.
- **Org B (guest house):** bookings spanning month boundaries, an out-of-service room, a cancelled booking, a deposit without a stay.
- **Org C (ISP):** subscribers expiring exactly at period boundaries, a renewed and a lapsed subscriber, a failed router action.
- **Org D:** a second organisation with overlapping product names and dates, to prove no cross-organisation leakage in queries or caches.
- **Offline case:** a sale created offline and not yet synced, to confirm it is shown as "pending sync" and not counted as a confirmed sale (see decisions).

Fixtures use known totals written down in the test, so the expected answer never comes from the code under test.

---

## 7. Progress tracker

| Phase | Owner | Status | PR / date | Notes |
|---|---|---|---|---|
| 0 Inventory and audit | Antigravity | Completed | 2026-11-25 | Inventory in `docs/data-integrity-inventory.md`, diagnosis in `docs/data-integrity-diagnosis.md`, and automated script `apps/backend/scripts/audit-data-integrity.ts`. Zero-sales week reproduced; H1–H12 tested with evidence. |
| A Metrics dictionary and contract | Antigravity | Completed | 2026-11-25 | `docs/metrics-dictionary.md` canonical definitions, shared types in `packages/types/src/index.ts` (`SeriesBucket`, `PeriodComparison`, `ResolvedAnalyticsRange`, etc.). |
| B Backend aggregation endpoints | Antigravity | Completed | 2026-11-25 | EAT (UTC+3) bucketing engine `time-buckets.ts`, `analytics.service.ts`, `vertical-analytics.service.ts` across all 7 verticals, wholesale `take:5` fix, composite dish deduction exclusion, honest comparisons (`deltaPct: null` when prev=0). |
| C Frontend data layer | Antigravity | Completed | 2026-11-25 | SWR cache invalidation on logout/org-switch (`useMyOrganization.tsx`, `SWRProvider.tsx`), ServiceWorker NetworkOnly for analytics/finance/isp (`sw.ts`), `ModernAnalyticsChart` default fallback removed & empty state implemented. |
| D Timeframe toggles | Antigravity | Completed | 2026-11-25 | `dashboard/page.tsx` wires `preset` into SWR key and API query; `tab1Bars` derived from server `sevenDaySales`; chart data from server `dailyPerformance`. |
| E Vertical-by-vertical pass | Antigravity | Completed | 2026-11-25 | All 7 verticals updated in `features/dashboard/config/*.ts` (retail, chemist, restaurant, wholesale, guest-house, isp, school) — removed hardcoded deltas and fake sparkline multiplier arrays; honest zero/empty states. |
| F Guardrails and CI | Antigravity | Completed | 2026-11-25 | Backend `data-integrity.spec.ts` (9 tests), Frontend `data-integrity-guard.spec.ts` (36 tests) enforcing zero hardcoded fake fixtures/deltas. 971 backend tests + 360 frontend tests passing. |
| G Animation and chart integrity | Antigravity | Completed | 2026-11-26 | Fixed liquid progress maths and bar chart animations: LiquidProgress renders 0% stationary tube when value <= 0 (no meniscus/sheen/bubbles/surge); BentoStatisticsCard removed fake `Math.max(bar.pct, 8)` minimum height and fake mock defaults; BentoGrowthCard defaults to '—'; FinanceExplorer removed 2% min share; all 7 vertical dashboards wired strictly to backend `data.dailySeries` (no fake scalar ratio arrays `[0.4, 0.55, 0.7...]`). Guard test expanded to 209 passing checks across all 11 dashboard directories. |

---

## 8. Open decisions (answer before the relevant phase)

1. **What counts as a sale?** Which invoice/transaction statuses are included; how voids and refunds are treated (subtracted or excluded).
2. **Revenue basis:** recorded sale total or amount actually paid? Tax included or excluded?
3. **Timezone:** one fixed zone (Africa/Nairobi) or per-organisation setting?
4. **Week definition:** Monday-start, Sunday-start, or rolling 7 days for "This week"?
5. **Stock valuation:** quantity × cost or × selling price?
6. **Offline and unsynced records:** show separately as "pending sync", or exclude until synced?
7. **Comparison policy:** compare partial periods to full previous periods, to the same elapsed portion, or not at all?
8. **Freshness:** what staleness is acceptable (seconds or minutes) and how long may server caches live?
9. **Seeded or demo data:** should any demo organisation exist in production, and if so how is it kept separate?
