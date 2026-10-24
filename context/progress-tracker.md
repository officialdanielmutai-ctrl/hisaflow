# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Stage 1 — Foundation Layer (Not started)

## Current Goal

- Set up monorepo structure, design system tokens, app shell, backend
  infrastructure, and authentication core before any feature work begins.

## Completed

- **Stage 1 — Foundation Layer**:
  1. **Monorepo & project structure** — Initialised Next.js (frontend) and
     NestJS (backend) in a monorepo. Configured TypeScript strict mode, ESLint,
     Prettier, and shared `types/` package. (CI pipeline placeholder assumed via tools configuration)

## In Progress

- None (Moved to Completed)

## Next Up

### Stage 1 — Foundation Layer

1. **Monorepo & project structure** — Initialise Next.js (frontend) and
   NestJS (backend) in a monorepo. Configure TypeScript strict mode, ESLint,
   Prettier, and shared `types/` package. Set up CI pipeline.

2. **Design system foundations** — Implement all CSS custom property tokens
   from `ui-context.md` in `globals.css`. Configure Tailwind to reference
   tokens. Install and configure shadcn/ui. Build semantic component wrappers:
   `AttentionFeed`, `AlertCard`, `InventoryCard`, `OperationalSummary`,
   `ConfidenceBadge`, `StatusDot`.

3. **App shell & navigation** — Build mobile layout shell (top app bar, bottom
   navigation, safe-area containers), routing, and auth route guards. Do not
   build feature screens yet — structural infrastructure only.

4. **Backend infrastructure foundation** — NestJS app with PostgreSQL
   connection (Prisma), Redis connection (BullMQ + cache), R2/S3 storage
   abstraction, config service, structured logging, global exception filter,
   validation pipeline.

5. **Authentication core** — Clerk integration: phone OTP + Google OAuth on
   frontend, JWT validation guard on NestJS backend, organization membership
   guard, session management. All routes protected by default; public routes
   explicitly listed.

### Stage 2 — Operational Truth Core (follows Stage 1)

6. Organization domain, staff membership, basic RBAC (Owner / Manager / Staff)
7. Inventory item model + Prisma schema
8. Inventory ledger (append-only transaction events)
9. Inventory mutation engine (add, remove, adjust, wastage) + audit logging
10. Transaction domain model + service + linkage to inventory mutations

### Stage 3 — Core Operational Flows (follows Stage 2)

11. Inventory list screen (search, filter, cards, quick actions)
12. Inventory detail screen (quantity, recent activity, health, actions)
13. Quick Transaction Flow (mobile-optimised: sale, purchase, adjustment)
14. Transaction timeline feed

### Stage 4 — Operational Awareness (follows Stage 3)

15. Dashboard foundation (shell, summary cards, layout hierarchy)
16. Attention Feed (event prioritisation, severity logic, operational copy)
17. Alerts system (rules engine, alert model, feed, resolution lifecycle)
18. Operational intelligence engine (low stock detection, dead stock, trends,
    restock recommendations)

### Stage 5 — AI Assistance System (follows Stage 4)

19. AI proposal model + Prisma schema (non-operational until confirmed)
20. OCR upload pipeline (R2 upload → BullMQ job → Cloud Vision OCR)
21. AI review interface (editable proposals, confidence badges, correction
    flow, confirmation boundary)
22. Text parsing ingestion (LLM extraction from free-text inventory input)
23. AI commit pipeline (human-confirmed proposal → deterministic inventory
    mutation via transactions module)
24. CSV/Excel import with AI-assisted column mapping
25. Voice input (speech-to-text → transcript display → LLM extraction)

### Stage 6 — Resilience Layer (follows Stage 5)

26. Offline cache layer (critical dashboard data, recent inventory)
27. Pending action queue (transaction submissions while offline)
28. Connectivity awareness UI (offline banner, sync status)
29. Sync recovery engine

### Stage 7 — Notifications & Realtime (follows Stage 6)

30. Push notification delivery (PWA service worker)
31. WhatsApp notification via Meta WABA (daily summary, low-stock alert)
32. SMS delivery via Africa's Talking / Twilio
33. Realtime inventory updates (TanStack Query invalidation on mutation)

## Open Questions

- **OTP provider for V1**: Africa's Talking vs. Twilio vs. Mobile Sasa for SMS
  OTP delivery in Kenya. Recommendation: Africa's Talking (Kenya-native,
  competitive pricing, MPESA alignment). Needs pricing confirmation before
  Stage 1 auth work begins.

- **Voice input STT provider**: Google Cloud STT (60 min/month free, then
  $0.016/min) vs. OpenAI Whisper ($0.006/min, no free tier). A hybrid may be
  used (Google free tier, Whisper as overflow). Decision needed before Stage 5.

- **Gemini model version for production**: Gemini 2.5 Flash is the planned
  primary LLM. Confirm API availability and pricing before AI ingestion work
  begins (Stage 5).

- **Offline conflict resolution strategy**: V1 targets simple cache + queue
  (not full offline-first). Confirm: if two staff members submit conflicting
  stock adjustments while offline, does the system reject the second and
  surface an error, or attempt a merge? Decision needed before Stage 6.

- **Business type configuration scope**: The business type selector (duka,
  chemist, restaurant, school, etc.) should configure terminology and
  automation defaults. Which types are supported in V1, and what are the
  specific per-type differences? Needs product input before Stage 1 onboarding
  work begins.

- **Multi-branch support timeline**: Multi-branch operations are out of scope
  for V1 but the `organizations` schema should be designed to accommodate it.
  Confirm whether `branch_id` should be added to inventory and transaction
  tables in Stage 2 to avoid a painful migration later.

## Architecture Decisions

- **Modular monolith for backend (not microservices)**: NestJS with strongly
  isolated domain modules communicating via events. One deployable unit, one
  primary database. Microservices deferred until V2 scale demands it.

- **AI outputs are proposals, never direct mutations**: All AI ingestion paths
  produce an `InventoryProposal` record with `status: pending_review`. The
  `inventory` module owns the decision to accept and commit. This is a
  constitutional rule and must not be bypassed by any feature.

- **Append-only transaction ledger**: Inventory quantities are derived by
  replaying transaction events. No direct quantity mutations outside of the
  transactions module. This enables full auditability and historical
  reconstruction.

- **PostgreSQL is the single source of truth**: Redis is ephemeral. If Redis
  is wiped, operations continue from PostgreSQL. Caches and queue state are
  transient; business data is not.

- **Multi-tenant isolation via `organization_id`**: Every business-owned table
  carries `organization_id`. Repository helpers enforce scoping. Direct
  unscoped queries against business tables are a critical violation.

- **PWA-first (no native apps in V1)**: Reduces engineering cost significantly,
  aligns with the target demographic (Android-heavy, storage-constrained,
  WhatsApp-native). Native app deferred until product-market fit is validated.

- **Clerk for authentication**: Handles OTP, OAuth, session management, and
  device tracking. Avoids weeks of custom auth implementation. Free tier covers
  up to 50,000 monthly active users.

- **Deterministic intelligence before AI intelligence**: Rules-based alert
  generation (low stock thresholds, expiry date checks) is built in Stage 4
  before AI-powered anomaly detection. Business data must exist before
  intelligence can be meaningful.

## Session Notes

- **2026-10-24 — Settings vertical gating and logo wiring.** Settings now
  renders the existing Business logo card for owners/managers, so the logo in
  the signed-in shell can be changed from Settings and reset to the email
  fallback. The Hardware section and `RouterSettingsCard` are now gated behind
  `isIsp`, so MikroTik setup only appears for ISP organisations; all other
  verticals keep Team management without any router controls. Added Settings
  page tests for the ISP/non-ISP and owner/manager cases.
- **2026-10-24 — KPI terminal glow and Lagoon contrast.** Moved the finance
  sparkline's breathing light onto the terminal dot itself (the stretched
  under-chart ellipse is gone), and made the AI recommendation panel fully
  token-driven: its surface, dividers, icons, priority badges and action links
  now follow the active theme instead of a fixed pale-green/white palette. The
  same semantic treatment was applied to the ISP and retail Smart
  Recommendations panels. Lagoon's primary/secondary/muted text steps were
  brightened, and the dark-theme bridge now remaps legacy pale status panels
  and fixed near-white sheets so remaining older screens stay readable in all
  dark themes. Verified with theme contract tests, frontend unit tests,
  typecheck, lint and production build.
- **2026-10-24 — KPI finance charts and 3D liquid animation.** Replaced the
  rough card animations with a shared, production-looking system. Sparklines
  now use monotone cubic interpolation, a recessed grid, a soft area volume,
  a three-layer 3D ribbon, a one-shot trace on page load and a terminal marker
  with a slow breathing light pooled underneath the final point. Liquid
  progress was extracted into `LiquidProgress` (shared by `StatCard` and
  `BentoGrowthCard`) with a glass-tube track, 3D shading, a wobbling meniscus,
  a moving specular sheen and seven rising bubbles. Reduced-motion users see
  the final chart/fill states with no animation. Verified with the full
  frontend test suite, typecheck, lint and production build.
- **2026-10-23 — Dashboard greeting and business branding.** Added a shared
  cinematic time-of-day greeting across every vertical (persistent ambient
  motion, reduced-motion safe), removed greeting subtitles/vertical labels, and
  added per-organisation business logos: email-domain default, monogram
  fallback, persisted logo URL, Settings swap card, and business-brand shell
  marks. Also removed the "Guest House workspace" line from the navbar.
- **2026-10-23 — Named theme system.** Added `@hisaflow/theme` (typed contract,
  six themes, generated CSS, contrast tests), the no-flash `ThemeProvider`
  (cookie SSR + localStorage + Auto), shape/depth/density/motion tokens, and
  the responsive Settings → Appearance picker for PC and mobile, with direct
  palette entry points in the top bar, desktop rail and mobile side menu. The
  standalone light/dark toggle was removed, and legacy text utilities are
  bridged to tested semantic text/status tokens. Docs live in
  `docs/theme/`; status is in `HISAFLOW_THEME_SYSTEM_DIRECTIVE.md` §10.
- **2026-10-19 — Home customisation production follow-up.** Fixed the four
  reported blockers: customisation changes now preview live on Home; widget
  long-press/right-click/⋯ opens the menu; widgets can be reordered (drag,
  buttons, keyboard) and added from a full gallery; and wallpaper is applied
  Home-wide with a live preview. See `hisaflow-workspace-customisation.md`
  §12.1 and `hisaflow-overhaul-defect-log.md` Q-028–Q-031.
- This is a greenfield build. No existing codebase.
- The six context files represent the complete architectural blueprint.
  Implementation should follow the staged build order strictly.
- When starting Stage 1, the first agent session should be: read all six
  context files, initialise the monorepo, and implement the design system
  tokens and shadcn setup only. Do not begin auth or backend work in the
  same session.
- All environment variables must be documented in `.env.example` as they are
  introduced. Never commit actual secrets.
