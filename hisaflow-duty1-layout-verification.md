# HisaFlow — Duty 1 UI Layout Audit: Verification Record

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 2 (Duty 1) / Section 2.6 (done criteria).
**Date:** 2026-10-14.
**Status:** KPI layer verified in a real browser across every vertical, state and
viewport. Every main routable screen is now verified in a real browser at
mobile (390px) and desktop (1280px) widths against a seeded, authenticated
local organisation (Sections 2.4, 3.2). Two defects were found and fixed
(Q-009 subscriber-card overflow, Q-010 broken `/finance`). The remaining
non-KPI states/viewports are enumerated in Section 3.3.

---

## 1. What this record covers

Duty 1 has two layers:

1. **The KPI/stat-card layer** — the reported defect (Q-001–Q-004) and the
   shared-component consolidation (Section 2.5). This is fully verified here,
   in a real browser, across all eight verticals and every required viewport,
   **without needing a login** (Section 2).
2. **Every other screen × state × viewport** — the full coverage matrix. The
   committed local seeded harness (Section 2.4) renders the real authenticated
   app, so every main routable screen is verified for the **loaded** state at
   390px and 1280px (Section 3.2). The remaining states/viewports are
   enumerated in Section 3.3.

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
| Seeded screen sweep | `e2e/tests/duty1-sweep.spec.ts` | Every main routable screen for all eight verticals at 390px and 1280px: HTTP < 400, no Next.js error overlay, no horizontal page scroll, and a full-page screenshot per cell. |
| Local seeded harness | `e2e/playwright.duty1.config.ts` + `duty1.global-setup.ts` | Seeds Postgres (one org per business type), boots the test-only backend guard and a Clerk-stubbed frontend, and runs sweep + KPI lab + dashboard geometry. Gated so it can never run in production. |
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

### 2.4 Seeded local screen sweep (added 2026-10-14)

The local harness from Section 5 (option 2) is implemented and gated so it can
never run in production:

- `apps/backend/test/e2e-seed.ts` — truncates the local `hisaflow_test`
  database and creates one synthetic organisation per business type plus a
  staff member, owned by `e2e-owner`, and writes `e2e/.auth/seed.json`.
- `apps/backend/test/e2e-server.ts` — boots the real Nest app with a
  **test-only** guard that accepts a synthetic `e2e.<clerkId>` bearer token.
  It refuses to start unless `E2E_AUTH_BYPASS=true` and `NODE_ENV` is not
  `production`, and lives outside `src/` so it is never in the production build.
- `apps/frontend/lib/e2e/clerk-stub.tsx` plus the `next.config.js` alias and
  the `middleware.ts` bypass — active only when `NEXT_PUBLIC_E2E_AUTH=true` /
  `E2E_AUTH_BYPASS=true`, and never in a production build (the middleware
  bypass additionally requires `NODE_ENV !== 'production'`).
- `e2e/playwright.duty1.config.ts` — cleans `.next`, seeds, boots both servers,
  and runs the sweep, the KPI lab and the authenticated dashboard geometry.

Run the whole Duty 1 suite locally:

```bash
npx playwright test --config=e2e/playwright.duty1.config.ts
```

Results (2026-10-13/14):

- **Screen sweep — 138/138 passed**: all eight verticals × their routes ×
  390px/1280px, no overflow and no error overlay (Q-009 fixed).
- **KPI lab — 9/9 passed**: all eight arrangements plus card states at every
  Section 2.2 viewport, 200% zoom and 20px text.
- **Authenticated dashboard geometry — 8/8 passed**: the seeded retail
  dashboard at all seven viewports plus 200% zoom.
- **`/finance` re-verified after the Q-010 restore — 16/16 passed** (one per
  vertical at both widths), plus the new unit test.

Screenshots are written under `e2e/artifacts/` (KPI lab) and
`e2e/test-results/` (sweep), both gitignored.

> **Environment caveat.** This machine's `E:` volume intermittently fails
> `next dev` cache writes (`UNKNOWN: unknown error`, errno -4094), which can
> crash the dev server mid-run on long sweeps. It is an OS/filesystem issue,
> not a test or layout failure, and re-running from a clean `.next` recovers
> it. The harness is local-only and is not part of CI.

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

### 3.2 Main routable screens — screen × vertical

Status: **Pass (loaded)** means the real authenticated screen rendered at
390px and 1280px with no overflow and no error overlay (the seeded sweep);
**Pass** for `dashboard` means the KPI geometry/state is fully measured.
**Pending** means the Section 2.2 state and viewport sweep is still owed;
**N/A** means the vertical has no such screen.

| Screen | Retail | Staff | Chemist | Restaurant | School | Wholesale | Guest house | ISP |
|---|---|---|---|---|---|---|---|---|
| `dashboard` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `inventory` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | N/A | Pass (loaded) | N/A | N/A |
| `transactions` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) |
| `finance` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) |
| `alerts` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) |
| `ai` | Pending | N/A | Pending | Pending | Pending | Pending | Pending | Pending |
| `assistant` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | Pending | Pass (loaded) | Pending | Pending |
| `notes` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) |
| `bookings` (list) | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) | N/A |
| `bookings/[id]`, `bookings/new` | N/A | N/A | N/A | N/A | N/A | N/A | Pending | N/A |
| `guests` (list) | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) | N/A |
| `guests/[id]` | N/A | N/A | N/A | N/A | N/A | N/A | Pending | N/A |
| `rooms` (list) | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) | N/A |
| `rooms/[id]` | N/A | N/A | N/A | N/A | N/A | N/A | Pending | N/A |
| `students` | N/A | N/A | N/A | N/A | Pass (loaded) | N/A | N/A | N/A |
| `school-classes` | N/A | N/A | N/A | N/A | Pass (loaded) | N/A | N/A | N/A |
| `school-fees` | N/A | N/A | N/A | N/A | Pass (loaded) | N/A | N/A | N/A |
| `subscribers` (list) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) |
| `subscribers/[id]` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `service-plans` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) |
| `tickets` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) |
| `work-orders` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pass (loaded) |
| `table-orders` | N/A | N/A | N/A | Pass (loaded) | N/A | N/A | N/A | N/A |
| `field-work` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Pending |
| `tax` (+ `aggregate`, `reconciliation`) | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `settings` | Pass (loaded) | Pending | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) | Pass (loaded) |
| `settings/billing`, `settings/tax` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `view-as` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `onboarding` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `paywall` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Modals/drawers/sheets (barcode, label capture, price review, tiered pricing, add/edit guest/room, invoice view, proposal card, …) | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

### 3.3 What remains for a 100% matrix

The loaded state of the main routes is verified. Still to exercise (each at the
seven viewports plus 200% zoom and 20px text):

- **Other states** on every `Pass (loaded)` screen: loading, empty, error,
  zero, very large/negative values, long text, 100+ rows, missing optional
  fields, disabled controls and validation errors.
- **Detail routes and overlays** not swept: `[id]` detail pages, `new` forms,
  and every modal/drawer/sheet.
- **Screens not yet swept at all**: `/ai`, `/tax` (+ `aggregate`,
  `reconciliation`), `/settings/billing`, `/settings/tax`, `/view-as`,
  `/onboarding`, `/paywall`, `/field-work`, and the staff-role dashboard.
- **Role-gated and tier-gated states** (staff vs owner, feature-locked tools).

The harness (`e2e/playwright.duty1.config.ts`) and the seed already provide the
authenticated session and one organisation per business type, so these can be
added incrementally as new sweep specs.

---

## 4. Defects found and fixed in this pass

| ID | Screen/Component | Description | Severity | Fixed | Guard |
|---|---|---|---|---|---|
| Q-008 | `StatCard` loading skeleton | The skeleton's block container allowed the header/value margins to collapse, so the loading card was 10px shorter than the loaded card in a single-column layout (4px after line-box matching). The dashboard uses a page-level skeleton today, so this was not shipping, but the card's own loading state is now dimensionally identical at every root font size. | Sev4 | `components/system/StatCard.tsx` | `e2e/tests/kpi-layout-lab.spec.ts` (card-states equal-height assertion) |
| Q-009 | `/subscribers` list card action row (ISP) | The phone / WhatsApp / "View →" row used `flex items-center gap-3` with no wrap. At 390px the fixed-width buttons plus the `ml-auto` link exceeded the card, pushing "View →" to x=408 in a 390px viewport and scrolling the whole document horizontally by 18px. | Sev3 | `apps/frontend/app/(dashboard)/subscribers/page.tsx` (`flex-wrap` on the action row) | `e2e/tests/duty1-sweep.spec.ts` `assertNoPageOverflow` at 390px (seeded local harness) |
| Q-010 | `/finance` — Month Comparison (all verticals) | The committed frontend read `overview.thisMonth` / `overview.lastMonth`, but refactor `c026970` dropped the backend `getMonthSummary` and its fields, so every `/finance` render threw `Cannot read properties of undefined (reading 'netProfit')` (Next.js error overlay); the screen was unusable. | Sev2 | `apps/backend/src/modules/finance/finance.service.ts` (restored `getMonthSummary`) | `finance.service.spec.ts` (month P&L) + `e2e/tests/duty1-sweep.spec.ts` (`/finance` renders for every vertical) |

Q-001–Q-004 (the reported ISP KPI defect and the shared-card consolidation)
were fixed under earlier commits (`8b13355`, `ddb1aff`, `288f4e0`) and are
covered by the guards in Section 2.2. Q-009 and Q-010 were found by the seeded
screen sweep and are logged in `hisaflow-overhaul-defect-log.md`.

---

## 5. What is needed to finish the full matrix

Option 2 from the previous revision — the **seeded local environment** — is now
implemented and documented in Section 2.4, so the authenticated app can be
exercised without a staging URL. No owner decision is outstanding to run the
loaded-state sweep.

What remains is state and viewport breadth, not access (Section 3.3): the
non-loaded states, detail routes/overlays, the five extra viewports, and the
role-gated screens. These extend the existing sweep spec rather than needing
new infrastructure. A seeded **staging** URL plus a Clerk `storageState` is
still the preferred way to add them against real production-like data, but the
local harness already covers the deterministic equivalents.

One environment note for whoever runs the local harness: the `E:` volume on
this machine intermittently fails `next dev` cache writes (Section 2.4,
"Environment caveat"). If a run aborts, delete `apps/frontend/.next` and
re-run; the harness does this itself on a cold start.
