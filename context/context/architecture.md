# Architecture Context

## Stack

| Layer              | Technology                          | Role                                                            |
| ------------------ | ----------------------------------- | --------------------------------------------------------------- |
| Frontend Framework | Next.js 15 + TypeScript             | PWA shell, SSR/ISR pages, API routes, auth integration          |
| UI Styling         | Tailwind CSS + shadcn/ui            | Utility-first styling, accessible component primitives          |
| Data Fetching      | TanStack Query v5                   | Client-side cache, optimistic updates, mutation handling        |
| Auth               | Clerk                               | Phone OTP, Google OAuth, session management, JWT issuance       |
| Backend API        | NestJS + TypeScript (separate app)  | Modular domain services, validation pipelines, event bus        |
| ORM                | Prisma                              | Type-safe DB access, schema migrations                          |
| Primary Database   | PostgreSQL                          | ACID-compliant operational truth, inventory ledger, audit log   |
| Queue / Async      | BullMQ (backed by Redis)            | OCR jobs, transcription, alert generation, notification sending |
| Cache              | Redis                               | Session refs, dashboard summaries, rate limiting, OTP throttle  |
| Object Storage     | Cloudflare R2 (or AWS S3)           | Uploaded images, audio files, CSV/PDF invoices                  |
| AI / LLM           | Gemini 2.5 Flash (primary)          | Inventory extraction, text parsing, category inference          |
| OCR                | Google Cloud Vision OCR             | Handwritten notebooks, receipts, shelf photos                   |
| Speech-to-Text     | Google Cloud STT / OpenAI Whisper   | Voice inventory input, WhatsApp voice notes                     |
| Notifications      | Africa's Talking (SMS), Meta WABA   | Low-stock alerts, daily summaries, EOD reports                  |
| Monitoring         | Sentry (errors) + PostHog (product) | Ingestion failures, OCR errors, onboarding drop-off             |
| Deployment         | Docker on Railway or Render (V1)    | Simple container deployment; AWS/GCP migration later            |

## System Boundaries

### Frontend (`/src` — Next.js app)

- `app/` — Next.js App Router pages and layouts; default to Server Components
- `features/` — Feature-level UI modules (auth, dashboard, inventory,
  transactions, alerts, ai, onboarding, settings). Each feature owns its own
  components, hooks, and client-side state.
- `components/ui/` — Raw shadcn/ui primitives; do not add business logic here
- `components/system/` — Hisaflow semantic operational components
  (AttentionFeed, AlertCard, InventoryCard, AIReviewPanel, ActionBlock, etc.)
- `components/mobile/` — Bottom sheets, floating action buttons, touch-optimised
  patterns
- `components/layout/` — Screen shells, bottom navigation, safe-area containers
- `lib/` — Shared utilities (date formatting, money formatting, unit conversion)
- `hooks/` — Reusable React hooks (useInventory, useTransactions, useAlerts)
- `services/` — API client wrappers for backend calls

### Backend (`/src` — NestJS app)

- `core/` — Global foundations: JWT guards, exception filters, validation
  pipelines, logging, authorization middleware. No business logic.
- `modules/auth/` — OTP verification, token issuance, refresh tokens, session
  validation. Does NOT own permissions or inventory access.
- `modules/organizations/` — Tenant creation, business metadata, staff
  membership, subscription metadata.
- `modules/users/` — User profiles, preferences, activity references.
- `modules/inventory/` — Inventory state engine. Owns products, quantities,
  units, categories, thresholds. The single source of current inventory truth.
- `modules/transactions/` — Append-only inventory movement ledger: sales,
  purchases, adjustments, wastage, returns, transfers.
- `modules/ai-ingestion/` — OCR orchestration, transcription, LLM parsing,
  normalization, proposal generation, confidence scoring. NEVER directly
  mutates inventory.
- `modules/uploads/` — File uploads, storage keys, signed URLs, media
  metadata. Does not own OCR.
- `modules/alerts/` — Rules-based alert generation, low-stock detection,
  dead-stock flags, anomaly rules, alert state management. Does NOT send
  notifications directly.
- `modules/notifications/` — SMS/WhatsApp/push delivery, retry handling,
  delivery history. Does NOT decide what deserves an alert.
- `modules/analytics/` — Dashboard aggregations, KPI calculations, trend
  queries. Does NOT own transactional truth.
- `modules/audit/` — Immutable change history, actor tracking, before/after
  states, security events. Receives events from other modules.
- `infrastructure/` — Prisma repositories, external SDK wrappers (Africa's
  Talking, Gemini, Cloud Vision, BullMQ, R2/S3, Redis). Business modules
  depend on abstractions, not SDK internals.
- `jobs/` — BullMQ workers: OCR worker, alert processor, summary generator,
  notification sender. Jobs call domain modules; they do not contain business
  rules.
- `events/` — Internal NestJS event definitions (InventoryAdjusted,
  StockBelowThreshold, InvoiceUploaded, AIExtractionCompleted,
  TransactionLogged). Modules communicate through events, not direct imports.
- `shared/` — Generic utilities only: date helpers, money formatting, unit
  converters, common DTOs, shared enums. No business logic.
- `config/` — Environment config service, secrets abstraction.

## Storage Model

- **PostgreSQL (authoritative operational truth)**: organizations, users,
  inventory items, stock quantities, inventory ledger transactions, AI
  extraction proposals + confidence scores, alert records, audit events,
  notification history. If Redis is wiped and R2 is unavailable, PostgreSQL
  still contains the complete operational record.
- **Redis (ephemeral fast state)**: BullMQ job queues (OCR, transcription,
  alert, notification jobs), dashboard summary cache, OTP rate limiting,
  AI processing state (upload pending / extraction in progress).
- **Cloudflare R2 / AWS S3 (binary assets)**: uploaded images (invoices,
  receipts, shelf photos, handwritten notebooks), audio files (voice input,
  WhatsApp voice notes), CSV/Excel imports, PDF invoices. PostgreSQL stores
  only the storage key reference, never the file itself.
- **Clerk (session state)**: active user sessions, device tokens, OAuth
  identity. Not duplicated in PostgreSQL.

## Auth and Access Model

- Every user authenticates via Clerk (phone OTP primary, Google OAuth
  secondary). Clerk issues a JWT that the NestJS backend validates on every
  request.
- Every API request that reaches a domain controller must pass through the
  JWT guard (authentication) and the organization membership guard
  (authorization) before any business logic runs.
- Every business-owned database record includes `organization_id`. All queries
  are scoped to the authenticated user's organization. Unscoped queries are a
  critical violation.
- Role hierarchy: Owner (full access including billing and staff management),
  Manager (inventory, transactions, analytics, approval flows), Staff (log
  sales and stock movement only; cannot access sensitive settings or billing).
- Permissions are role-driven, not user-specific. Avoid per-user permission
  overrides in V1.
- AI-extracted data is stored as proposals with a `status` of `pending_review`
  until a human confirms. Proposals carry a `source: "ai"` flag in the audit
  log.

## Invariants

1. **Inventory truth is deterministic.** AI may suggest, extract, and infer,
   but only a validated, human-confirmed transaction commit may mutate stock
   quantities. AI output that bypasses the confirmation step is a critical
   architectural violation.
2. **The inventory ledger is append-only.** Stock state is always
   reconstructable by replaying the transaction ledger. Cached quantities are
   derived values — they may never diverge from the ledger permanently.
3. **Multi-tenant isolation is non-negotiable.** Every query that touches
   business data must include `WHERE organization_id = ?`. An API route that
   returns data without scoping it to the authenticated tenant is a critical
   security violation.
4. **AI providers are abstracted.** Business modules call an `AIProvider`
   interface (with methods like `extractInventory()`, `transcribeVoice()`,
   `categorizeProducts()`). No module imports Gemini, OpenAI, or Anthropic
   SDKs directly.
5. **Infrastructure must not leak into domain logic.** Business modules must
   not import Redis, BullMQ, R2/S3, or external SDK internals directly. They
   call infrastructure abstractions.
6. **Async work must not block user-facing requests.** OCR processing,
   transcription, alert generation, and notification delivery are all
   queue-based (BullMQ). A user upload returns immediately after the job is
   enqueued; processing happens asynchronously.
7. **Controllers do not own business logic.** Controllers validate and
   authenticate, then delegate to service classes. Inventory rules,
   transaction calculations, and alert decisions live in services.
8. **All critical mutations produce audit records.** Inventory adjustments,
   role changes, AI-confirmed imports, and threshold modifications must each
   produce an immutable audit event with actor, timestamp, before state,
   after state, and source channel.
9. **Configuration is never hardcoded.** API keys, thresholds, provider URLs,
   and credentials are loaded from the environment config service. No raw
   `process.env` access outside `config/`.
10. **Silent failure is forbidden.** Every catch block on critical paths
    (inventory commits, transaction logging, AI ingestion, notifications) must
    log, alert, and either retry or surface the error appropriately. Empty
    catch blocks are a violation.
