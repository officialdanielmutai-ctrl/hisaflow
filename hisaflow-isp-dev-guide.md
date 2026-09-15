# HisaFlow — ISP / WISP Industry Vertical: Development Guide

**Status:** Ready for implementation
**Audience:** Development agent / engineer picking up this work
**Purpose:** Define exactly what to build, in what order, what "done" means for each piece, and track progress as it's completed. This is an execution doc, not a pitch — pair it with `hisaflow-guesthouse-scope.md` for the pattern this repo already follows when adding a vertical.

---

## 0. Context for whoever (or whatever) is building this

Before touching code, understand these things about how HisaFlow already works — the ISP vertical is not a new app, it's new entities and screens layered onto the existing monorepo.

- **Monorepo shape:** Turborepo, pnpm/npm workspaces (`apps/*`, `packages/*`). Shared types live in `packages/types` — any new entity (`Subscriber`, `ServicePlan`, `WorkOrder`, `Ticket`) gets its type defined there first so both `apps/gateway` and the frontend consume the same shape.
- **`apps/gateway`:** the backend/API service. New endpoints for this vertical live here, following whatever pattern existing resources (organizations, inventory, bookings) already use — don't invent a new API style.
- **Organizations have a `businessType` field.** This vertical is gated behind a new businessType value (e.g. `ISP`) the same way `DUKA`, `RESTAURANT`, `SCHOOL` etc. already gate the general retail feature set, and the way the guest-house vertical is presumably gated behind its own type. Confirm the existing enum location (likely in `packages/types` and mirrored in the onboarding UI, per `page.tsx`) before adding to it.
- **Reuse the inventory engine — don't fork it.** The guest-house vertical proved the pattern: don't build a parallel "consumption" system, extend `InventoryTransaction` with an optional foreign key (`bookingId` there, `subscriberId`/`installationId` here). Do the same here for equipment tracking. This keeps stock levels, reporting, and the existing sales flow untouched.
- **Invoicing pattern already exists** (room charge + consumption + manual line items − deposits, from the guest-house scope). The ISP invoice is structurally the same shape: plan charge (recurring) + equipment/manual line items − payments received. Reuse `Invoice` / `InvoiceLineItem`, don't create parallel billing models.
- **Payments are M-Pesa-first.** Whatever payment recording pattern exists for guest-house/duka invoices (cash, M-Pesa, card as a payment method field) is the pattern to extend — not a new payment subsystem.

**If any of the above assumptions turn out to be wrong once you're in the actual code** (e.g. `businessType` lives somewhere else, or invoices aren't structured this way yet), stop and reconcile this doc against reality before proceeding — don't silently build a parallel structure.

---

## 1. Data model additions (for planning — confirm final schema against `packages/types`)

New entities:

| Entity | Purpose | Key relationships |
|---|---|---|
| `Subscriber` | Persistent customer record | belongs to `Organization`; has many `Invoice`, `WorkOrder`, `Ticket` |
| `ServicePlan` | A billable plan (speed tier, hotspot bundle, static IP package) | belongs to `Organization`; referenced by `Subscriber.planId` |
| `WorkOrder` | Install / repair / relocation job | belongs to `Subscriber`; optionally links `InventoryTransaction`s for equipment used |
| `Ticket` | Support issue | belongs to `Subscriber` |

Modified entities:

- `InventoryTransaction` — add optional `subscriberId` (or `workOrderId`) so equipment issued (routers, ONTs, cables) deducts from stock and is traceable to a specific install, exactly like the guest-house `bookingId` extension.
- `Invoice` — extend to support a recurring/subscription context: link to `Subscriber` and `ServicePlan`, alongside the existing manual line item and payment support.

`Subscriber` fields (minimum): name, phone, install address, connection type (`PPPOE` / `HOTSPOT` / `STATIC_IP`), plan reference, status (`ACTIVE` / `SUSPENDED` / `CHURNED`).

---

## 2. Phases, scope, and "done" criteria

Each phase below is scoped by **layer** (data model → API → frontend) so partial progress is trackable and reviewable layer-by-layer, not just phase-by-phase.

### Phase 1 — Subscriber Management
*Foundational. Nothing else works without it.*

- **Data model:** `Subscriber` entity created in `packages/types` and persisted in `apps/gateway`.
- **API:** CRUD endpoints for subscribers, scoped to an organization.
- **Frontend:** Subscriber list view, create/edit form, subscriber detail page showing status and (once later phases land) plan, invoices, work orders, tickets.

**Done when:**
- A subscriber can be created, edited, and deactivated from the UI.
- Subscriber list shows name, phone, connection type, and status at a glance.
- Subscriber detail page exists as the anchor page later phases attach data to (even if some sections are empty placeholders until their phase lands).

### Phase 2 — Service Plans & Recurring Billing
*The payoff feature most owners will pay for.*

- **Data model:** `ServicePlan` entity (name, price, connection type, billing cycle). `Invoice` extended to reference `Subscriber` + `ServicePlan`.
- **API:** CRUD for plans; endpoint(s) to generate an invoice for a subscriber on their billing cycle; payment recording (cash / M-Pesa / card) against an invoice.
- **Frontend:** Plan management screen; assign a plan to a subscriber; invoice list per subscriber; mark invoice as paid/partially paid.

**Done when:**
- An owner can define a plan (e.g. "10Mbps Home — KES 2,500/month") and assign it to a subscriber.
- Invoices generate on the subscriber's billing cycle without manual arithmetic.
- A payment (cash or M-Pesa) can be recorded against an invoice and the balance updates correctly.
- Subscriber status does **not** yet auto-change based on payment — that's Phase 5 (router integration). For now, non-payment is visible on the invoice/subscriber view but requires a manual suspend action if the owner chooses.

### Phase 3 — Equipment / Hardware Tracking
*The differentiator — same role consumption-tracking played for guest houses.*

- **Data model:** `InventoryTransaction` extended with optional `subscriberId`/`workOrderId`.
- **API:** Ability to log an inventory item (router, ONT, cable) against a subscriber or work order, deducting stock exactly as a normal sale does.
- **Frontend:** From a subscriber (or work order, once Phase 4 exists) detail page, add an equipment line item by picking an inventory item + quantity.

**Done when:**
- Equipment issued to a subscriber deducts from general inventory stock.
- All equipment tied to a subscriber is visible from their record — not mixed into general shop sales.
- Equipment line items can be pulled into an invoice as a one-time charge (e.g. router purchase fee).

### Phase 4 — Work Orders (Installations & Repairs)
*The guest-house "booking" equivalent for this vertical.*

- **Data model:** `WorkOrder` entity (type: install/repair/relocation, status, assigned technician if applicable, linked subscriber).
- **API:** CRUD for work orders; status transitions (Scheduled → In Progress → Completed → Cancelled).
- **Frontend:** Work order list (all jobs, filterable by status), create a job against a subscriber, mark complete.

**Done when:**
- A work order can be created against a subscriber with a type and scheduled date.
- Completing a work order is a distinct, visible action (not just deleting/archiving it).
- Equipment logged during Phase 3 can be attached to the specific work order it was used for.

### Phase 5 — Support Tickets
*Lightweight — a history, not a full helpdesk.*

- **Data model:** `Ticket` entity (subject, description, status, linked subscriber).
- **API:** CRUD for tickets.
- **Frontend:** Ticket list per subscriber and org-wide; open/close a ticket.

**Done when:**
- A ticket can be logged against a subscriber and shows up in their record.
- Org-wide ticket list exists so nothing gets lost in individual subscriber pages.

### Phase 6 — MikroTik Router Integration *(separate scoping required before starting)*
*Highest leverage, highest technical risk — do not bundle into earlier phases.*

This phase needs its own design pass before implementation starts: MikroTik API access model (per-organization router credentials?), hosting/network reachability considerations (routers are usually behind NAT on customer sites), and failure handling (what happens if the router is unreachable when a suspend/reconnect should fire). Don't scope "done" criteria for this until that design pass happens — flag it as a follow-up doc.

---

## 3. Explicitly out of scope (for this whole vertical, current effort)

- Full network monitoring / NMS (bandwidth graphs, uptime dashboards)
- RADIUS server hosting
- GIS / tower-sector mapping, multi-tower bandwidth shaping
- Hotspot voucher/captive-portal generation (candidate for a later phase once Phase 1–5 are stable)

These are legitimate next-phase candidates once the core loop is in production — worth revisiting after adoption data comes in, not before.

---

## 4. Progress tracker

Update this table as work lands. One row per layer per phase — check off as merged, not as "started."

| Phase | Layer | Status | Notes |
|---|---|---|---|
| 1. Subscriber Management | Data model | ☑ Done | Added Subscriber model and relations to schema.prisma |
| 1. Subscriber Management | API | ☑ Done | Subscribers CRUD + suspend/reactivate/churn endpoints in IspModule |
| 1. Subscriber Management | Frontend | ☑ Done | Subscriber list and detail pages with tappable Phone/WhatsApp CTAs |
| 2. Service Plans & Billing | Data model | ☑ Done | Added ServicePlan model, updated Invoice with subscriberId/planId |
| 2. Service Plans & Billing | API | ☑ Done | ServicePlans CRUD, IspInvoices generation & payment recording |
| 2. Service Plans & Billing | Frontend | ☑ Done | Service plans page, subscriber invoices tab with M-Pesa/Cash payment |
| 3. Equipment Tracking | Data model | ☑ Done | Updated InventoryTransaction with subscriberId/workOrderId |
| 3. Equipment Tracking | API | ☑ Done | Equipment issuance with inventory stock deduction & invoice charging |
| 3. Equipment Tracking | Frontend | ☑ Done | Equipment tab on subscriber detail page with inventory picker |
| 4. Work Orders | Data model | ☑ Done | Added WorkOrder model and relations to schema.prisma |
| 4. Work Orders | API | ☑ Done | Work orders CRUD with Scheduled/In Progress/Completed transitions |
| 4. Work Orders | Frontend | ☑ Done | Work orders page & subscriber detail work orders tab |
| 5. Support Tickets | Data model | ☑ Done | Added Ticket model to schema.prisma |
| 5. Support Tickets | API | ☑ Done | Tickets CRUD with Open/In Progress/Resolved/Closed transitions |
| 5. Support Tickets | Frontend | ☑ Done | Tickets page & subscriber detail tickets tab |
| 6. MikroTik Integration | Design pass | ☐ Not started | Blocks all sub-tasks until scoped |

**How to update:** change `☐ Not started` to `☐ In progress` when work begins on a row, and `☑ Done` once merged to `main`. Add a one-line note (PR link, date, or blocker) in the Notes column. Don't mark a phase's layer done until its "Done when" criteria in Section 2 are met — partial implementation stays "In progress."

---

## 5. Guidance for the agent picking this up

- Work phase by phase, layer by layer within a phase (data model → API → frontend) — don't build frontend against an API that doesn't exist yet, and don't skip ahead to Phase 3 before Phase 1's "done when" criteria are actually met.
- Before starting Phase 1, confirm the `businessType` enum location and add `ISP` (or the agreed value) to it, and confirm how existing verticals gate their UI (conditional rendering based on org type) so this vertical follows the same convention rather than introducing a new one.
- When in doubt about a modeling decision, check how the guest-house vertical solved the equivalent problem first (`Booking` ↔ `Subscriber`/`WorkOrder`, `bookingId` extension on `InventoryTransaction` ↔ this vertical's `subscriberId` extension) — consistency across verticals matters more than a locally "better" design.
- Update the progress tracker in this same file as part of the PR that completes each row — not as a separate housekeeping task someone does later.
