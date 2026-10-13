# HisaFlow — Duty 1 UI Layout Audit: Verification Record

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 2 (Duty 1) / Section 2.6 (done criteria).
**Date:** 2026-10-13.
**Status:** KPI layer verified in a real browser across every vertical, state and
viewport. Remaining screens are **blocked on a seeded, authenticated
environment** (see Section 5) — the code and automated guards are complete.

---

## 1. What this record covers

Duty 1 has two layers:

1. **The KPI/stat-card layer** — the reported defect (Q-001–Q-004) and the
   shared-component consolidation (Section 2.5). This is fully verified here,
   in a real browser, across all eight verticals and every required viewport,
   **without needing a login** (Section 2).
2. **Every other screen × state × viewport** — the full coverage matrix. This
   needs a running app with an authenticated, seeded organisation; it is
   enumerated and blocked in Section 5.

---

## 2. KPI-layer verification (complete)

### 2.1 Harness

- **Route:** `/gallery/kpi` — a dev-only, no-auth page that renders every
  vertical's KPI arrangement (`DashboardKpiRows` + per-vertical configs) with
  synthetic **adversarial** data (zero and very large values) inside the real
  dashboard column width (`max-w-lg`). It also renders the four card states
  (default / loading / empty / error). Like `/gallery`, it 404s in production
  unless `NEXT_PUBLIC_ENABLE_GALLERY=true`, so no internal surface leaks.
- **Data:** synthetic only. No customer data, no real organisation.
- **Browser:** system Chrome via Playwright (the bundled Chromium build
  matching the installed Playwright could not be downloaded in this
  environment; CI's scheduled e2e installs the bundled browser).

### 2.2 Automated measured guards

| Guard | File | What it asserts |
|---|---|---|
| KPI lab (all verticals) | `e2e/tests/kpi-layout-lab.spec.ts` | At 360/390/768/1024/1280/1440/1920: no card overflow, every card ≥44px, equal-height siblings, value baselines aligned (multi-column rows), card states equal height, and no horizontal page scroll. Also 200% browser zoom at 1280 and 20px root text at 390. Writes screenshots per viewport. |
| Authenticated dashboard | `e2e/tests/dashboard-layout.spec.ts` | The same geometry assertions against the real `/dashboard` for a seeded org, at all seven viewports + 200% zoom. Skips without `E2E_BASE_URL`. |
| Shared geometry helpers | `e2e/tests/helpers/kpi-geometry.ts` | One implementation of the measurement/assertion rules for both specs. |
| Structural guards (always-on) | `apps/frontend/components/system/StatCard.spec.tsx`, `lib/kpi-format.spec.ts`, `features/dashboard/config/kpi-arrangements.spec.ts` | Card slots/tones/states, number formatting, and each vertical's metric set/order/source. |
| Utility guard (always-on) | `apps/frontend/lib/tailwind-utility-guard.spec.ts` | Bans the invalid v3 utilities from Q-001/Q-002 repo-wide. |

Run the KPI lab locally:

```bash
# terminal 1
cd apps/frontend && NEXT_PUBLIC_ENABLE_GALLERY=true npx next dev -p 3100
# terminal 2
E2E_KPI_LAB_URL=http://localhost:3100/gallery/kpi npx playwright test \
  --config=e2e/playwright.config.ts e2e/tests/kpi-layout-lab.spec.ts
```

### 2.3 Results

Nine measured browsers passes, all green (2026-10-13):

- 360px, 390px, 768px, 1024px, 1280px, 1440px, 1920px — all verticals, large
  and zero data.
- 200% browser zoom at 1280px.
- 20px root text at 390px.

Screenshots were captured to `e2e/artifacts/` (gitignored) and reviewed
against the Section 2.4 checklist: no overflow, no clipping, consistent
icon/label/value/footnote alignment, tabular figures, compact long values with
the full value in the `title`, equal card heights per row, and no page-level
horizontal scroll. Mobile stacks to one column as designed; desktop shows two.

---

## 3. Coverage matrix

Status values: **Pass** (measured/asserted), **Fixed** (defect found and
corrected), **Pending** (needs the seeded authenticated environment), **N/A**
(no such screen for that vertical).

### 3.1 KPI layer — vertical × scenario × viewport

| Vertical (business type) | large | zero | 7 viewports | zoom/text | Status |
|---|---|---|---|---|---|
| Retail (DUKA / MINI_MART) KPI + inventory snapshot | Pass | Pass | Pass | Pass | Pass |
| Staff dashboard | Pass | Pass | Pass | Pass | Pass |
| Chemist | Pass | Pass | Pass | Pass | Pass |
| Restaurant | Pass | Pass | Pass | Pass | Pass |
| School | Pass | Pass | Pass | Pass | Pass |
| Wholesaler | Pass | Pass | Pass | Pass | Pass |
| Guest house | Pass | Pass | Pass | Pass | Pass |
| ISP | Pass | Pass | Pass | Pass | Pass |
| Card states (default/loading/empty/error) | — | — | Pass | Pass | Pass |

### 3.2 Remaining screens — screen × vertical

The KPI rows on each dashboard are Pass. Every other routable screen and every
modal/drawer/sheet below is **Pending** until the blocked environment exists;
each cell must then be exercised in the Section 2.2 state list
(loaded/loading/empty/error/zero/large/negative/long-text/100+ rows/missing
optional/disabled/validation) at the seven viewports plus zoom/text, and the
defect log updated.

| Screen | Retail | Staff | Chemist | Restaurant | School | Wholesale | Guest house | ISP |
|---|---|---|---|---|---|---|---|---|
| `dashboard` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `inventory` | Pending | Pending | Pending | Pending | Pending | Pending | N/A | N/A |
| `transactions` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `finance` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `alerts` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `ai` | Pending | N/A | Pending | Pending | Pending | Pending | Pending | Pending |
| `assistant` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `notes` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `bookings` / `bookings/[id]` / `bookings/new` | N/A | N/A | N/A | N/A | N/A | N/A | Pending | N/A |
| `guests` / `guests/[id]` | N/A | N/A | N/A | N/A | N/A | N/A | Pending | N/A |
| `rooms` / `rooms/[id]` | N/A | N/A | N/A | N/A | N/A | N/A | Pending | N/A |
| `students` | N/A | N/A | N/A | N/A | Pending | N/A | N/A | N/A |
| `school-classes` | N/A | N/A | N/A | N/A | Pending | N/A | N/A | N/A |
| `school-fees` | N/A | N/A | N/A | N/A | Pending | N/A | N/A | N/A |
| `subscribers` / `subscribers/[id]` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `service-plans` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `tickets` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `work-orders` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `table-orders` | N/A | N/A | N/A | Pending | N/A | N/A | N/A | N/A |
| `field-work` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `tax` (+ `aggregate`, `reconciliation`) | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `settings` (+ `billing`, `tax`) | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `view-as` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `onboarding` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `paywall` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Modals/drawers/sheets (barcode, label capture, price review, tiered pricing, add/edit guest/room, invoice view, proposal card, …) | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

---

## 4. Defects found and fixed in this pass

| ID | Screen/Component | Description | Severity | Fixed | Guard |
|---|---|---|---|---|---|
| Q-008 | `StatCard` loading skeleton | The skeleton's block container allowed the header/value margins to collapse, so the loading card was 10px shorter than the loaded card in a single-column layout (4px after line-box matching). The dashboard uses a page-level skeleton today, so this was not shipping, but the card's own loading state is now dimensionally identical at every root font size. | Sev4 | `components/system/StatCard.tsx` | `e2e/tests/kpi-layout-lab.spec.ts` (card-states equal-height assertion) |

Q-001–Q-004 (the reported ISP KPI defect and the shared-card consolidation)
were fixed under earlier commits (`8b13355`, `ddb1aff`, `288f4e0`) and are
covered by the guards in Section 2.2.

---

## 5. What is needed to finish the full matrix

The remaining screens need a running app with an authenticated, seeded
organisation and realistic per-vertical data. Two acceptable ways to provide
it — please pick one:

1. **Staging (preferred, no code change):** a seeded staging URL plus a Clerk
   `storageState` file for an owner of each vertical's test org (and a staff
   one for role-gated screens). Set `E2E_BASE_URL` and `E2E_STORAGE_STATE`;
   `dashboard-layout.spec.ts` and the screenshot/geometry run then execute
   unchanged. This is Question 1 from the Phase 0 discovery, still unanswered.
2. **Seeded local environment (needs approval):** stand up a local test
   bootstrap that seeds Postgres with one org per business type and bypasses
   Clerk **only** for the e2e run (test-only entrypoint, never enabled in
   production). This adds a test-only auth path, so it needs explicit
   sign-off before it is written.

Until one is provided, the KPI layer is the only part of Duty 1 that can be
verified in a browser, and every other cell in Section 3.2 stays `Pending`.
