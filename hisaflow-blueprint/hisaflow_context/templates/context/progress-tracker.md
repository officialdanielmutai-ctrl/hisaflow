# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Stage 1 — Foundation Layer (Not started)

## Current Goal

- Set up monorepo structure, design system tokens, app shell, backend
  infrastructure, and authentication core before any feature work begins.

## Completed

- None yet.

## In Progress

- None yet.

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

- This is a greenfield build. No existing codebase.
- The six context files represent the complete architectural blueprint.
  Implementation should follow the staged build order strictly.
- When starting Stage 1, the first agent session should be: read all six
  context files, initialise the monorepo, and implement the design system
  tokens and shadcn setup only. Do not begin auth or backend work in the
  same session.
- All environment variables must be documented in `.env.example` as they are
  introduced. Never commit actual secrets.
