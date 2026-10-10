# HisaFlow — Quality & Assistant Overhaul: Phase 0 Discovery Report

**Directive:** `hisaflow-quality-and-assistant-overhaul.md` (Section 6, Phase 0 — mandatory, read-only).
**Status:** Delivered for owner review. **No code changed.**
**Date:** 2026-10-10.

---

## 1. Repo map

pnpm + Turborepo monorepo. Package manager `pnpm@11.2.2` (`pnpm-workspace.yaml` → `apps/*`, `packages/*`). Root scripts: `build` / `dev` / `lint` (all `turbo run …`), `format`, `test:e2e` (`playwright test --config=e2e/playwright.config.ts`).

| App | Package | Role | Framework / runner |
|---|---|---|---|
| `apps/backend` | `backend` | Domain API (modular monolith, NestJS) | NestJS; Jest (81 suites / 585 tests); ESLint; Prisma |
| `apps/frontend` | `frontend` | Customer PWA (marketing + authenticated app) | Next.js 15.2.8 (App Router), React 18; `node --test` + Vitest; `next lint` |
| `apps/admin` | `admin` | Internal admin panel | Next.js; Vitest; `next lint` |
| `apps/gateway` | (no package.json scripts) | LiteLLM proxy container | Dockerfile + `config.yaml` + `.env(.example)` only |
| `packages/types` | — | Shared types | TypeScript |

- **Backend** has no `package.json` `lint:fix`-free path: `lint` is `eslint "…" --fix` (CI runs `pnpm lint`; it exits 0). Backend test command: `jest`.
- **Frontend** test command: `node --no-warnings --test lib/paywall-context.test.ts … && vitest run`. Build: `next build`.
- **E2E** is a separate Playwright project (`e2e/`, `@playwright/test ^1.49.1`) that targets a deployed/seeded `E2E_BASE_URL` with a Clerk `storageState`; it is **not** runnable against localhost without a seeded authenticated session.
- **Styling:** Tailwind CSS **3.4.19** + CSS custom properties in `apps/frontend/app/globals.css` (`--color-*`, `--radius-*`, `--shadow-*`, `--mk-*`). `tailwind.config.ts` extends colors/radius/shadow/spacing/font — it is **v3**, so v4-only utilities (e.g. `shadow-xs`, `shadow-2xs`) and non-scale fractions (e.g. `h-4.5`) are invalid/no-op. Component conventions: shadcn/ui under `components/ui`, feature components under `components/<domain>`.
- **CI** (`.github/workflows/ci.yml`) jobs: `install → typecheck → lint → backend-test → backend-test-e2e → frontend-test → admin-test → build`. `e2e.yml` runs the Playwright suite on a schedule / manual dispatch against `E2E_BASE_URL`.
- **Deployment:** frontend on Vercel (see `hisaflow-deployment.md`); gateway via `docker-compose.yml` (service `gateway`, port 4000); backend hosts inferred from env (`DATABASE_URL`, Redis, R2).

### Environment caveat (this machine)
`pnpm --filter <app> exec …` fails in this Windows shell (`ENOENT … 'E:\'`), so the equivalent compilers were run directly from each workspace (`npx tsc --noEmit -p tsconfig.json`, `npx next lint`, `npx jest`, `npx vitest run`, `npm test`). These are the same tools the scripts invoke. No config, rule, or tsconfig was changed.

## 2. Baseline run (before any change)

| Gate | Command used | Result |
|---|---|---|
| Typecheck backend | `tsc --noEmit -p tsconfig.json` | **Pass** |
| Typecheck frontend | `tsc --noEmit -p tsconfig.json` | **Pass** |
| Typecheck admin | `tsc --noEmit -p tsconfig.json` | **Pass** |
| Typecheck e2e | `tsc --noEmit -p e2e/tsconfig.json` | **Pass** |
| Lint frontend | `next lint` | **Pass** (warnings only) |
| Lint admin | `next lint` | **Pass** (warnings only) |
| Lint backend | `eslint "src/**/*.ts"` (no `--fix`) | **Pass**, **580 warnings, 0 errors** |
| Tests backend | `jest` | **Pass** — 81 suites / 585 tests |
| Tests frontend | `npm test` | **Pass** — 35 node + 94 vitest (17 files) |
| Tests admin | `vitest run` | **Pass** — 2 files / 12 tests |
| CI | — | Not run locally (no push in Phase 0); workflows read. Pre-existing backend lint warnings are recorded, not fixed. |

Local runtime observed: frontend `:3000`, backend `:3001`, admin `:3002` are listening; no Postgres/Redis on `:5432`/`:6379`. `GET /api/health` and `/health` on `:3001` returned 404 (the health route shape needs confirming — see Questions).

## 3. Verticals and screens inventory (Duty 1 matrix skeleton)

**Business types** (`BusinessType` enum, `apps/backend/src/modules/organizations/dto/create-organization.dto.ts`):
`DUKA`, `MINI_MART`, `CHEMIST`, `RESTAURANT`, `SCHOOL`, `WHOLESALER`, `ISP`, `GUEST_HOUSE`.

**Dashboard components** (`apps/frontend/components/<domain>/…Dashboard.tsx`): `RetailDashboard` (default/DUKA/MINI_MART, inline in `app/(dashboard)/dashboard/page.tsx`), `ChemistDashboard`, `RestaurantDashboard`, `WholesaleDashboard`, `SchoolDashboard`, `GuestHouseDashboard`, `IspDashboard`, plus `StaffDashboard` (role-gated). Routing at `dashboard/page.tsx:461-468`.

**Routable screens** (`apps/frontend/app/(dashboard)/`): `dashboard`, `inventory`, `transactions`, `finance`, `alerts`, `ai`, `notes`, `bookings`, `guests`, `rooms`, `students`, `school-classes`, `school-fees`, `subscribers`, `service-plans`, `tickets`, `work-orders`, `table-orders`, `field-work`, `tax` (+ `tax/aggregate`, `tax/reconciliation`), `settings` (+ `settings/billing`, `settings/tax`), `view-as`, plus `onboarding` and `paywall`. Modals/drawers/sheets exist under `components/system` (e.g. `BarcodeScannerSheet`, `LabelCaptureSheet`, `PriceReviewSheet`, `TieredPricingSheet`) and `components/ui`.

**Matrix axes to complete:** vertical × screen × state (loaded / loading / empty / error / zero / large / negative / long text / 100+ rows / missing optional / disabled / validation) × viewport (360, 390, 768, 1024, 1280, 1440, 1920 + 200% zoom + increased text at 390). The matrix is **not yet filled** — it requires a seeded authenticated environment (see Questions).

## 4. Services inventory (Duty 3 register skeleton)

Derived from `apps/backend/src/modules`, `docker-compose.yml`, `apps/gateway`, and env config.

| Service | Owner module / host | Notes |
|---|---|---|
| Web frontend (PWA, marketing + app) | `apps/frontend` (Vercel) | Next.js; public routes + authenticated routes |
| Backend domain API | `apps/backend` (NestJS) | 28 modules (inventory, transactions, invoices, finance, bookings, guests, rooms, isp, school-*, tax, paywall, notifications, alerts, analytics, audit, users, uploads, ocr, ai-ingestion, …) |
| LiteLLM gateway | `apps/gateway` (port 4000) | Dockerfile + `config.yaml`; called by `ai-ingestion`/`finance-ai`/`analytics` |
| Database | Postgres via `DATABASE_URL` / Prisma | Single source of truth |
| Redis | `REDIS_HOST`/`REDIS_PORT`, BullMQ jobs | Ephemeral |
| Object storage | R2 (`R2_*`) | Uploads/OCR |
| Auth | Clerk | JWT/org membership |
| Payments | Paystack (`PAYSTACK_*`) | Paywall live; sandbox pending (F-02) |
| Tax signing | KRA eTIMS VSCU bridge (`ETIMS_*`) | Tax system live behind flags |
| Notifications | `notifications`, `admin/comms` | WhatsApp (Meta WABA), SMS (Africa's Talking), email (Resend) — mock mode without keys |
| Analytics | PostHog (`POSTHOG_*`), Sentry (`SENTRY_DSN`) | Optional |
| Scheduled jobs | `src/jobs` | M-Pesa renewal, tax sync, reconciliation, alerts |

Register is **skeleton only**; no service has been exercised end to end yet (requires staging/seeded run). Planned-but-out-of-scope items (per doc): paywall/tax/admin only if already live — paywall and tax **are** live in the codebase.

## 5. Assistant map (Duty 2 / Phase A inputs)

- **Entry points:** `apps/backend/src/modules/ai-ingestion/` (`parseInventoryText`, `ai-ingestion.controller.ts`), `apps/backend/src/modules/ocr/`, `finance/finance-ai.service.ts`, `analytics/analytics.service.ts`. No dedicated assistant/chat UI exists in the frontend (`components/` and `features/` have no assistant/chat module) — the conversational surface described in Section 3.10 is **not built**.
- **Provider:** an `OpenAI` client pointed at `litellm.baseUrl` with `litellm.masterKey` (`config/configuration.ts`). Gemini is scaffolded separately (`gemini.*`), Cloud Vision for OCR.
- **Current design is exactly the prompt-heavy pattern the directive targets:** `AiIngestionService` assembles one large per-`businessType` prose prompt (CHEMIST / DUKA·MINI_MART / RESTAURANT / GUEST_HOUSE / SCHOOL / WHOLESALER / ISP branches, OCR-mode branches) plus a JSON inventory snippet, and asks the model to return a JSON array of action shapes (`SALE`, `PURCHASE`, `WASTAGE`, `CREATE`, `UPDATE`, `NOTE`, `BOOKING`, `GUEST`, `ROOM`). There is **no tool registry**; capabilities are enumerated in prose.
- **Accept/reject:** the model returns candidate actions; the human reviews/edits/confirms in the app before any domain mutation (consistent with the constitutional "AI outputs are proposals" rule in `context/progress-tracker.md`). Exact review UI/components need confirming for the parity list.
- **Data model:** Prisma (`apps/backend/prisma/schema.prisma`); an `InventoryProposal`-style model is referenced in architecture decisions. No `Proposal`/tool-registry models exist yet.
- **Tooling:** `test_litellm.py` at repo root (LiteLLM connectivity probe). `apps/gateway/config.yaml` holds routing/model config.
- **Phase A gaps:** capability parity list, gap list, draft golden set (incl. Swahili/mixed-language), architecture decision note — none produced yet; this report only maps the starting point.

## 6. Existing KPI / stat-card implementations

- **Hand-built per vertical (no shared card):** `components/isp/IspDashboard.tsx`, `components/chemist/ChemistDashboard.tsx`, `components/restaurant/RestaurantDashboard.tsx`, `components/school/SchoolDashboard.tsx`, `components/wholesale/WholesaleDashboard.tsx`, `components/guesthouse/GuestHouseDashboard.tsx`, and the inline `RetailDashboard`/`StaffDashboard` in `app/(dashboard)/dashboard/page.tsx`.
- **Shared (but thin) primitive:** `components/system/OperationalSummary.tsx` — label + value + optional trend; not used by the vertical KPI rows.
- **Reported defect (ISP):** `IspDashboard.tsx` KPI cards use **invalid Tailwind v3 utilities** — `h-4.5 w-4.5` (×4 cards, icons silently fall back to the 24px lucide default instead of 18px, breaking the icon/label baseline) and `shadow-xs` / `shadow-2xs` (no-op). The same invalid shadow utilities also appear in `app/(dashboard)/work-orders/page.tsx`. Additionally, Tier-1 headers use an `ArrowUpRight` affordance while Tier-2 headers use a status pill, so the two rows' header heights/baselines differ by construction.

## 7. Questions for the owner

1. **Seeded/staging environment for Duty 1/Duty 3 evidence.** The geometry protocol (Section 2.3) needs a running, authenticated, seeded app plus screenshots at 7 viewports. Is there a staging URL + Clerk `storageState` I should use, or should I stand up a seeded local org? (Playwright is present but wired only to `E2E_BASE_URL`.)
2. **Backend health route.** `GET /api/health` and `/health` returned 404 locally. What is the canonical readiness/liveness endpoint (for Duty 3 health checks)?
3. **Vertical scope confirmation.** Is the live-vertical list exactly the 8 `BusinessType` values, or should any be excluded (e.g. `MINI_MART` sharing the retail dashboard)?
4. **Backend lint baseline.** 580 pre-existing warnings, 0 errors. Confirm we leave them as-is (no mass reformat) and only address warnings in files we touch.
5. **KPI long-number default.** The directive defaults to compact format (`KES 1.2M`) with full value on hover/focus/tap (Section 9.7). Confirm this is acceptable for KES figures in the dashboard, or prefer full grouped values where space allows.
6. **Duty order.** Directive §5 says Duty 3 baseline runs first/in parallel and Duty 2 depends on both; the tasking says start from Duty 1. Confirm that Duty 1 may proceed before the Duty 3 register is exercised, or reorder.

---

**Phase 0 status:** discovery output delivered; **no code changed**. Awaiting owner confirmation of this report and the Section 7 questions before any Duty 1/2/3 fix.
