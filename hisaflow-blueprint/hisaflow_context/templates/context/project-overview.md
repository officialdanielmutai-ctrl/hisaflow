# Hisaflow

## Overview

Hisaflow is a mobile-first Progressive Web App (PWA) that helps small and
medium businesses in East Africa — dukas, kiosks, chemists, restaurants, and
schools — track inventory, reconcile spending and sales, and receive proactive
operational intelligence through familiar channels (SMS, WhatsApp, push
notifications, and web). It transforms reactive, memory-driven operations into
a continuously monitored, data-aware system that prevents losses before they
happen and guides daily decision-making in plain language.

## Goals

1. Let any business owner set up their inventory in minutes using voice, text,
   image upload, or a spreadsheet — with AI extracting structure and the owner
   confirming before anything is committed.
2. Maintain a deterministic, always-reconstructable inventory ledger so stock
   truth is never dependent on AI output, caches, or summaries.
3. Surface proactive operational intelligence (low stock warnings, dead stock
   flags, usage anomalies, restock suggestions) through the dashboard and via
   WhatsApp or SMS — without the owner having to ask.
4. Support the full transaction lifecycle (sales, purchases, adjustments,
   wastage, returns) with an append-only audit trail that makes every change
   traceable.
5. Work reliably on mid-range Android devices over inconsistent mobile
   networks, behaving like a native app through PWA installation.
6. Enforce strict multi-tenant isolation so every business's data is fully
   separated from every other business's data on shared infrastructure.

## Core User Flow

1. User lands on the PWA and authenticates via phone number + OTP (primary)
   or Google login.
2. User completes lightweight business setup: name, type, staff count,
   preferred notification channel, and currency/location.
3. User chooses a setup method: manual product entry, CSV/Excel import, AI
   text/voice/image ingestion, or a starter template.
4. If using AI ingestion: user provides raw input → system extracts a
   structured inventory proposal → user reviews and edits → user confirms →
   inventory is initialised.
5. User is taken to the dashboard, which immediately surfaces the Attention
   Feed (anomalies, warnings, actions needed) and an Operational Snapshot
   (today's sales, low stock count, profit estimate).
6. User logs daily business activity: sales, stock-in from deliveries,
   adjustments, wastage — all via the Quick Transaction flow, reachable in
   1–2 taps.
7. System continuously monitors stock movement, sales velocity, expiry,
   variance, and supplier patterns — generating alerts and recommendations
   without requiring manual analysis.
8. User receives morning summaries, low-stock alerts, and EOD summaries via
   WhatsApp/SMS/push based on their chosen notification channel.

## Features

### Authentication & Identity
- Phone number + OTP (primary, Kenya-first via Africa's Talking or Twilio)
- Google OAuth login
- Email magic link (secondary)
- Multi-tenant architecture: every business is isolated by `organization_id`
- Roles: Owner (full access), Manager (operational + analytics), Staff
  (log sales and stock movement only)

### Business Onboarding
- Business type selector (duka, mini-mart, chemist, restaurant, school,
  wholesaler) — each type configures terminology, workflows, and automation
  defaults
- Preferred notification channel selection (SMS, WhatsApp, app, web)
- Currency and location setup (Kenya-first, KES default)

### AI-Assisted Inventory Setup
- Text input parsing: "Sugar 12 packets, Milk 5 boxes"
- Voice input: speech-to-text → LLM extraction → structured proposal
- Image/OCR upload: photograph a notebook, receipt, or shelf → OCR →
  LLM extraction → structured proposal
- CSV/Excel import with AI-assisted column mapping
- All AI outputs produce a reviewable, editable proposal — never a silent
  commit
- Confidence scoring: High / Review Recommended / Needs Attention

### Real-Time Inventory Ledger
- Append-only transaction ledger: every stock mutation is a durable event
- Running balances derived from ledger history — always reconstructable
- Inventory state per product: quantity, unit, category, reorder threshold,
  cost, expiry date (optional), supplier (optional)
- Basic variance tracking: expected vs. physical count
- Product search: fuzzy name search, category filter, recent products

### Transaction System
- Transaction types: sale, purchase/stock-in, adjustment, wastage, return,
  transfer
- Quick Transaction Flow: tap → search product → enter quantity → confirm
  (target: under 10 seconds)
- Reason field for adjustments and wastage
- Staff attribution on every transaction
- Transaction timeline: chronological operational feed in plain language

### Dashboard & Operational Awareness
- Attention Feed (first section): anomalies, low stock warnings, unusual
  usage, supplier issues — always at the top
- Operational Snapshot: today's sales, today's expenses, low stock count,
  profit estimate, pending deliveries
- Inventory Health section: fast-moving items, dead stock, expiring products,
  stock health score
- Recommended Actions: restock suggestions, supplier follow-up, pending
  approvals

### Alerts & Proactive Intelligence
- Rules-based alert generation (deterministic, not AI-driven initially):
  low stock detection, stockout prediction, dead stock flags, expiry risk,
  variance detection
- Alert severity hierarchy: Critical → Attention Needed → Informational
- Alert lifecycle: unresolved → resolved / snoozed / archived
- Notification delivery: push (primary), WhatsApp, SMS

### Audit & Traceability
- Every inventory mutation records: actor, timestamp, before state, after
  state, source channel, AI vs. human origin
- Audit log is immutable and always available for compliance and debugging
- Staff activity visibility for owners and managers

### Settings & Configuration
- Business profile, branches (later), currency
- Staff management and role assignment
- Notification preferences per channel
- Security: active session list, device management

## Scope

### In Scope (V1)

- PWA (web + installable on Android)
- Phone OTP + Google authentication via Clerk
- Multi-tenant business isolation
- Inventory CRUD with ledger-based state
- Transaction logging (sale, purchase, adjustment, wastage)
- AI ingestion: text, image/OCR, voice (basic), CSV import
- AI review + confirmation flow
- Dashboard with Attention Feed, Snapshot, Health, Recommendations
- Rules-based alerts (low stock, expiry, dead stock, variance)
- Push + WhatsApp + SMS notification delivery (basic)
- Audit log
- Owner, Manager, Staff roles
- Mobile-first UI (PWA, bottom navigation, bottom sheets)
- Basic offline cache + sync queue
- Kenya-first: KES currency, Safaricom SMS API, Africa's Talking

### Out of Scope (V1)

- Full accounting (double-entry, P&L, balance sheets, tax)
- Full POS ecosystem (receipt printers, payment terminals, loyalty systems)
- Enterprise ERP workflows (procurement chains, warehouse routing, HR)
- Advanced AI automation (autonomous purchasing, autonomous pricing)
- Complex ML forecasting and demand prediction
- Supplier marketplace or B2B ordering
- Multi-country tax and compliance
- Full distributed offline sync with conflict resolution
- Advanced customisation (drag-and-drop workflow builders, custom schemas)
- Native iOS/Android apps (V1 is PWA only)
- Barcode scanning infrastructure (deferred)

## Success Criteria

1. A business owner can complete onboarding and have their first inventory
   items committed within 5 minutes, using any supported input method.
2. Logging a sale, purchase, or stock adjustment takes under 10 seconds on a
   mid-range Android device.
3. The dashboard Attention Feed surfaces at least one actionable insight
   within 24 hours of first inventory being set up.
4. Stock levels derived from the transaction ledger always match the displayed
   inventory state — the ledger is the single source of truth.
5. A low-stock alert reaches the owner via their chosen notification channel
   within 15 minutes of the threshold being crossed.
6. An AI-ingested inventory proposal can be reviewed, edited, and confirmed in
   under 2 minutes.
7. The PWA passes a Lighthouse PWA audit and installs correctly on Android
   Chrome.
8. All queries are scoped by `organization_id` — no tenant data leakage is
   possible through any API route.
