# HisaFlow — Agent Build Briefs: Paywall & Tax System

**Status:** Ready to issue to build agents
**Scope:** `hisaflow-paywall.md` (Phases A–E; Phase F is the admin panel, tracked separately in `hisaflow-admin-panel.md` and out of scope for these briefs) and `hisaflow-tax-system.md` (Phases A–F).
**Audience:** Whoever is issuing prompts to the build agents — this doc is the source you draft each agent's actual instruction from.

---

## Part 1 — Ground rules (every agent, every layer)

These apply to every prompt in Part 2 below. Don't repeat them in full in each prompt — reference this section, but do not skip it.

### 1.1 Required reading, before any code
The agent must read, in full, before writing anything:
- `hisaflow-paywall.md` or `hisaflow-tax-system.md` (whichever this layer belongs to) — the whole doc, not just the assigned phase's section, since later phases assume earlier context (data model, naming conventions, Section 1A's floor/depth split).
- The other of the two docs, at minimum skimmed — Phase C of the paywall doc and the tax system both touch `Invoice`, and the naming-collision warnings in each doc only work if the agent has seen both.
- The existing repo conventions this doc's own research surfaced: the guest-house and ISP vertical scope docs, for the established patterns (retry/backoff via `RouterAction`, audit logging via `PaymentAttempt`/`AdminAuditLog`, the `businessType` gating pattern). New code should look like it was written by the same team that wrote those, not like a fresh start.
- **Confirm, don't assume, the actual current file locations** (`apps/gateway` vs `apps/backend` — this was flagged as unresolved back when the ISP implementation plan first came in, and never confirmed) before writing a single file path into a plan.

### 1.2 Non-regression discipline
- Run the existing test suite **before** starting and record the result. If it's not green before you start, that's a pre-existing issue to flag, not something to fix as a side effect of this task.
- Run it again after every meaningful change, not just at the end — catch a regression at the commit that caused it, not three phases later.
- Stay inside the declared scope of the phase. Touching files outside what the phase's "API"/"Frontend"/"Data model" lines describe requires stopping and flagging it, not proceeding silently — scope creep in an agent-driven build is how "fix one thing, break three unrelated things" happens unnoticed.
- New tables/columns are additive (nullable new fields, new tables) — nothing in these builds should require a breaking migration of existing `Invoice`, `InventoryTransaction`, `Organization`, or `Subscriber` data. If a phase seems to need one, stop and flag it rather than writing it.

### 1.3 Linting, type-checking, and CI
- Locate the actual configured commands in the repo (`package.json` scripts, any `.github/workflows/*` or equivalent CI config) and run **those** — do not guess a command name like `npm run lint` without confirming it's what the repo actually defines.
- A layer is not done if lint, type-check, or the existing test suite fail — this is a hard gate, not a warning to note and move past.
- If CI is configured to run on push/PR, the agent's branch must pass it before the phase is marked `Done` in the relevant doc's progress tracker — don't mark done locally and let CI catch problems after the fact.

### 1.4 Tooling
- Use the repo's own package manager and scripts, not ad-hoc commands that bypass configured tooling (e.g. don't hand-invoke a compiler directly if the repo has a build script that does more, like running codegen for Prisma).
- **If an MCP-exposed Rust-based lint/static-analysis tool is available in the agent's environment** (e.g. a Biome- or oxlint-class tool, faster and stricter than the JS-native equivalents), it should be used as an additional verification pass before a layer is marked done — but confirm the exact tool name and invocation actually available in-environment first; do not assume one exists or guess its interface.
- File edits: prefer targeted, minimal-diff edits over full-file rewrites wherever the tooling supports it — smaller diffs are easier to review and regress-check.

### 1.5 Definition of "Done" — applies to every layer below, on top of each phase's own doc-specified criteria
A layer is done when, and only when:
1. The phase's own "Done when" criteria (from the source `.md`) are met and demonstrably verified, not assumed.
2. Existing tests still pass; new functionality has its own tests covering at least the phase's "Done when" scenario.
3. Lint and type-check are clean per Section 1.3.
4. The relevant doc's progress tracker row is updated to `Done`, with a note (PR link, date) — this is part of the deliverable, not cleanup work for someone else.
5. Nothing outside the phase's declared scope changed.

### 1.6 Build order: backend before frontend, not backend-then-forget-frontend
Each phase below is split into a Backend prompt and a Frontend prompt. Backend goes first because frontend needs a stable API contract to build against — but the frontend prompt should be drafted and reviewed **before** backend work starts, not written as an afterthought once backend is "done." Issue the frontend prompt as soon as the backend API contract (endpoint shapes, request/response types) is stable enough to build against, even if backend implementation is still being finished — don't let frontend sit idle waiting for a "fully done" backend when the contract itself is already settled.

---

## Part 2 — Layer prompts: `hisaflow-paywall.md`

### Layer P-A — Paystack Foundation

**Backend prompt:**
> Read `hisaflow-paywall.md` in full, and Section 1.1–1.6 of `hisaflow-agent-build-briefs.md`. Your objective is Phase A: build the `HisaflowPlan`, `Subscription`, `PaymentAttempt`, and `WebhookEvent` data models (Section 4 of the paywall doc — note the naming discipline: `HisaflowPlan` must stay distinct from the ISP vertical's existing `ServicePlan`), and a webhook endpoint that verifies Paystack's signature per Section 3.4 exactly as specified (HMAC-SHA512 over the **raw** request body, `x-paystack-signature` header, timing-safe comparison, 200 response within the timeout, idempotent handling keyed on Paystack's transaction reference). This is the foundation every later phase depends on — get the signature verification right before anything else, including an explicit test that an intentionally invalid signature is rejected, not just a happy-path test. Apply Section 1.2's non-regression discipline throughout. Definition of done: Section 1.5 of the build-briefs doc, plus Phase A's own "Done when" in `hisaflow-paywall.md`. Update the paywall doc's progress tracker for this row when complete.

*(No frontend prompt for this layer — Phase A is backend/infrastructure only, per the source doc.)*

### Layer P-B — Card Subscriptions

**Backend prompt:**
> Read `hisaflow-paywall.md` Phase B in full (including the "How it works" narrative, not just the API/Frontend bullet points) plus Section 1.1–1.6 of the build-briefs doc. Confirm Layer P-A is merged and its webhook verification is working before starting. Your objective: create Paystack `Plan`s matching the three `HisaflowPlan` tiers, build the checkout flow that captures a card authorization and creates a Paystack `Subscription`, and handle the subscription lifecycle webhooks (`subscription.create`, `charge.success`, `invoice.payment_failed`) to keep HisaFlow's own `Subscription` row in sync. Do not build this as a variant of Phase C's M-Pesa logic — Section 3.1 vs 3.2 of the paywall doc establishes these are architecturally different (Paystack-native recurring vs. HisaFlow-owned scheduling); keep them as separate code paths now so Phase C doesn't inherit a wrong abstraction later. Definition of done: build-briefs Section 1.5 plus Phase B's "Done when" in the paywall doc.

**Frontend prompt** *(issue once the backend's checkout/subscription API contract is stable):*
> Read `hisaflow-paywall.md` Section 2 (Paywall design) in full, plus Phase B's frontend bullet. Build the paywall page: three tier cards (Section 2.2 — Team visually marked as recommended, all-in KES pricing shown up front per the defaulted figures in Section 7), with card selected as the payment method leading into the checkout flow the backend layer exposes. Also build the billing settings page showing current plan/status. Follow Section 2.1's entry-point guidance even though the in-context feature-lock trigger itself isn't wired up until Layer P-D — build this page so that entry point can be added later without restructuring it. Mobile-first, single column on small screens, per Section 2.2. Definition of done: build-briefs Section 1.5 plus Phase B's "Done when."

### Layer P-C — M-Pesa Manual Renewal Loop

**Backend prompt:**
> Read `hisaflow-paywall.md` Phase C in full plus Section 1.1–1.6 of the build-briefs doc. Confirm Layers P-A and P-B are merged first. Build the scheduled job described in Phase C: reminder before due date, Charge API call on the due date (mobile money channel, phone number — triggers the STK-via-Paystack flow per Section 3.3), logging every attempt to `PaymentAttempt`, retry with backoff on failure, and moving the org to `GRACE` status per the defaulted grace-period parameters in Section 7 (5 days, retries at day 0/2/4) once retries are exhausted. Reuse the retry/backoff pattern already established for `RouterAction` in the ISP vertical rather than inventing a new one — consistency across the codebase matters here specifically because a future maintainer debugging a retry issue shouldn't have to learn a fourth different pattern. Definition of done: build-briefs Section 1.5 plus Phase C's "Done when," including the specific test case of a deliberately failed/cancelled prompt resulting in the correct retry count before `GRACE`, not silent lapse or immediate lockout.

**Frontend prompt** *(issue once the backend charge/retry contract and status states are stable):*
> Read `hisaflow-paywall.md` Section 2.3 and 2.4, and Phase C's frontend bullet. Build the M-Pesa paywall flow, explicitly reflecting the extra checkout-page step described in Section 3.3 (the customer completes Paystack's checkout page before the STK prompt appears — don't imply an instant prompt with no intermediate screen). Build reminder notifications and grace-period messaging in-app for an overdue org, matching the defaulted 5-day/day-0-2-4 cadence from Section 7. Definition of done: build-briefs Section 1.5 plus Phase C's "Done when."

### Layer P-D — Seat & Tier Enforcement

**Backend prompt:**
> Read `hisaflow-paywall.md` Phase D in full plus Section 1A (the floor/depth matrix — this is what "tier-gated" actually means feature by feature). Confirm Layers P-A through P-C are merged. Build seat-limit enforcement (Clerk-org member count against `Subscription.seatAllowance`, auto-billing the extra seat per the defaulted seat-overage decision in Section 7 rather than blocking) and tier-feature gating as a second dimension on the existing `businessType` gate — do not build a parallel gating mechanism; extend the one that already exists. Definition of done: build-briefs Section 1.5 plus Phase D's "Done when."

**Frontend prompt** *(issue once the backend gating checks return a consistent, documented failure shape the frontend can route on):*
> Read `hisaflow-paywall.md` Section 2.1 and Phase D's frontend bullet. Wire the in-context paywall triggers: when a gated action is blocked by the backend checks from this layer, route to the paywall page (built in Layer P-B) with the specific blocked action preserved and surfaced in the messaging — "add a staff account" should land on a paywall explaining that specific limit, not a generic pricing page. Definition of done: build-briefs Section 1.5 plus Phase D's "Done when," including the specific test of triggering context being preserved end-to-end.

### Layer P-E — Billing Management UX

**Backend prompt:**
> Read `hisaflow-paywall.md` Phase E in full — pay particular attention to the "constraint that shapes it" paragraph. **Before writing any code, verify directly against current Paystack documentation whether a native change-plan/proration endpoint exists** (Section 7, item 5 — this was explicitly not defaulted, it's a factual check). If the doc's assumption (no native endpoint) holds, implement the disable-old/create-new pattern with the asymmetric upgrade-immediate/downgrade-at-renewal behavior exactly as specified. If Paystack has since added a native endpoint, stop and flag it — that changes this phase's design, not just its implementation, and shouldn't be built around silently. Definition of done: build-briefs Section 1.5 plus Phase E's "Done when."

**Frontend prompt** *(issue once the backend's upgrade/downgrade contract is confirmed and stable):*
> Read `hisaflow-paywall.md` Phase E's frontend bullet. Build self-serve upgrade/downgrade, seat add/remove, payment method change, and invoice/receipt history (pulled from Paystack's Transactions list). Make the immediate-upgrade vs. deferred-downgrade behavior explicit in the UI — a customer downgrading should clearly see "takes effect on [date]," not be left assuming it's instant. Definition of done: build-briefs Section 1.5 plus Phase E's "Done when."

---

## Part 3 — Layer prompts: `hisaflow-tax-system.md`

### Layer T-A — Organization Tax Registration

**Backend prompt:**
> Read `hisaflow-tax-system.md` in full, plus Section 1.1–1.6 of the build-briefs doc. **Before writing code, confirm the exact KRA eTIMS sandbox-to-production transition process directly against KRA's current documentation** (Section 7, item 2 — explicitly not defaulted). Build the `TaxRegistration` model and the endpoints to capture an org's KRA PIN and track eTIMS registration status. Definition of done: build-briefs Section 1.5 plus Phase A's "Done when," including that registration status is never presented as further along than it actually is (no implying instant activation).

**Frontend prompt** *(issue once the backend registration-status contract is stable):*
> Read `hisaflow-tax-system.md` Phase A's frontend bullet. Build the settings screen for entering a KRA PIN and viewing registration status, honestly representing "pending KRA approval" as a real, expected state per Section 5. Definition of done: build-briefs Section 1.5 plus Phase A's "Done when."

### Layer T-B — Automatic Per-Sale Tax Calculation

**Backend prompt:**
> Read `hisaflow-tax-system.md` Phase B in full plus Section 1 (the core design principle — this is not a feature the user triggers). Confirm Layer T-A is merged. Per the Section 7 default, build standard VAT/eTIMS calculation as the baseline; do not build Turnover Tax or simplified-regime branching now — that's explicitly deferred. Hook tax calculation into the existing invoice-creation path such that it is architecturally impossible to create an invoice for a tax-registered org without tax being calculated — if a code review finds a path around this, that's a bug in this layer, not an edge case to note for later. Definition of done: build-briefs Section 1.5 plus Phase B's "Done when."

*(No frontend prompt for this layer — Phase B is calculation logic with no dedicated UI; it surfaces through Layer T-D's Tax tab.)*

### Layer T-C — VSCU Signing & Offline Queue

**Backend prompt:**
> Read `hisaflow-tax-system.md` Phase C and Section 2 (the OSCU/VSCU distinction) in full. **Confirm Section 2's OSCU/VSCU technical details directly against KRA's current eTIMS integration documentation before starting** — this doc's architecture depends on VSCU supporting local signing while offline; verify that's still accurate. Build `TaxInvoiceRecord`, `TaxSyncQueue`, the VSCU signing integration, and the background sync job — applying the defaulted failure-mode distinction from Section 7 (device-offline → queue silently and retry on reconnect; a real error response from KRA's API → a separate backoff-and-alert path, since a prolonged KRA-side outage affecting many orgs is a different, more urgent problem than one offline device). Reuse the existing retry/backoff pattern from `RouterAction`/`PaymentAttempt` rather than inventing a new one. This phase is the one most likely to get simplified under time pressure ("require being online for now") — do not simplify it; the offline case is the entire point, per the Veira research this doc is grounded in. Definition of done: build-briefs Section 1.5 plus Phase C's "Done when," including the specific test of an offline-completed sale syncing correctly on reconnect.

*(No frontend prompt for this layer — signing/sync is backend infrastructure; status surfaces through Layer T-D.)*

### Layer T-D — Tax Tab: Status & Summary

**Frontend prompt** *(the exception to backend-first — this layer is frontend-only, built once T-A through T-C expose stable status data):*
> Read `hisaflow-tax-system.md` Phase D and Section 1 (core design principle) in full. Build the Tax tab as a strictly read-only status/summary display — filed/pending invoices, current period's tax summary. **Do not add any edit or manual-entry action for a filed invoice** — the moment this tab grows a data-entry path, the core design principle of this entire system is broken. Definition of done: build-briefs Section 1.5 plus Phase D's "Done when."

### Layer T-E — Reconciliation & Anomaly Detection (Team-tier depth)

**Backend prompt:**
> Read `hisaflow-tax-system.md` Phase E in full, and Section 1A of `hisaflow-paywall.md` (confirm this is correctly gated as Team-tier depth, not available to Solo, consistent with the floor/depth split). Build the scheduled reconciliation job comparing filed invoices against expected sales activity, flagging mismatches before a filing deadline. Definition of done: build-briefs Section 1.5 plus Phase E's "Done when," including the specific test of a deliberately introduced mismatch being correctly flagged.

**Frontend prompt** *(issue once the backend anomaly-detection contract is stable):*
> Read `hisaflow-tax-system.md` Phase E's frontend bullet. Build the reconciliation dashboard and anomaly alerts, gated to Team-tier per Layer P-D's tier enforcement (confirm that gating is actually wired to this screen, not just assumed). Definition of done: build-briefs Section 1.5 plus Phase E's "Done when."

### Layer T-F — Multi-Branch Aggregation (Growth multi-location depth)

**Backend + Frontend prompt** *(small enough to issue as one layer; confirm during scoping whether to split):*
> Read `hisaflow-tax-system.md` Phase F in full. Build the aggregated tax view across an org's multiple locations, tying into the same multi-location capability already scoped for the ISP vertical's multi-`Router` design and the guest-house multi-property case — reuse that existing multi-location concept rather than building a second one specific to tax. Definition of done: build-briefs Section 1.5 plus Phase F's "Done when."

---

## Part 4 — Master progress tracker (cross-references the two source docs)

| Layer | Backend | Frontend | Notes |
|---|---|---|---|
| P-A. Paystack Foundation | ☑ Done (2026-09-29) | — | Data models + signature-verified webhook (`POST /webhooks/paystack`); 17 tests incl. invalid-signature rejection. No frontend for this layer |
| P-B. Card Subscriptions | ☑ Done (2026-09-29) | ☑ Done (2026-09-29) | Backend: Paystack Plan provisioning, card checkout, lifecycle webhooks; 33 tests incl. renewal + failed→GRACE. Frontend: `/paywall` + `/settings/billing`, context-aware for Phase D. Growth shown as Custom (unpriced); M-Pesa disabled until Phase C |
| P-C. M-Pesa Renewal Loop | ☑ Done (2026-09-30) | ☑ Done (2026-09-30) | Backend: scheduler + Charge API + retries → GRACE; 50 tests. Frontend: M-Pesa checkout flow (extra Paystack step), phone capture, reminder/grace banners. F-10 closed. Live Paystack sandbox still pending (F-02) |
| P-D. Seat & Tier Enforcement | ☑ Done (2026-09-30) | ☑ Done (2026-09-30) | Entitlements policy (global), seat gate + auto-bill, `@RequiresFeatures` on the existing `RolesGuard`, multi-location gate; central paywall routing on `FeatureLockedError`. 70 tests. F-12 (overage rate) / F-13 (trial expiry) open |
| P-E. Billing Management UX | ☑ Done (2026-09-30) | ☑ Done (2026-09-30) | Paystack change-plan assumption re-verified against live docs (no native endpoint → disable-old/create-new). Backend: `BillingService` upgrade-immediate / downgrade-at-renewal, seats, payment-method change, Paystack Transactions-list receipts (local fallback); 84 tests total. Frontend: self-serve billing screen, explicit deferred-downgrade date, 13 tests. F-15 flagged |
| T-A. Org Tax Registration | ☑ Done (2026-09-30) | ☑ Done (2026-09-30) | KRA sandbox→production process verified against current KRA docs (separate sandbox/production hosts; Service Request + Commitment Form; KRA approval required; production is a further certification step). Backend `TaxRegistration` + 4 endpoints, `canFileLive` gated to `PRODUCTION_ACTIVE`; 95 tests total. Frontend `/settings/tax` with honest pending states, a load-error state, and an onboarding explainer; 22 tests |
| T-B. Automatic Tax Calculation | ☑ Done (2026-09-30) | — | No dedicated frontend; surfaces via T-D | `InvoiceTaxService` is the only creator of `Invoice`/`InvoiceLineItem`; standard 16% VAT calculated automatically for tax-registered orgs (inclusive), zero otherwise. All 3 existing invoice-creation paths refactored; static guard test enforces the choke point. 109 tests total. F-19/F-20 flagged |
| T-C. VSCU Signing & Offline Queue | ☑ Done (2026-09-30) | — | No frontend prompt for this layer — signing/sync is backend infrastructure; status surfaces through T-D | KRA offline-signing claim re-verified. `TaxInvoiceRecord` + `TaxSyncQueue`, local VSCU signing, ordered sync job with offline-vs-KRA-error split, `GET /tax/sync-status`. 123 tests total. F-21 (live contract) / F-22 (branch id) flagged |
| T-D. Tax Tab (Status & Summary) | — | ☑ Done (2026-09-30) | Read-only `/tax` tab + read-only `GET /tax/report`; no data-entry path (enforced by test). 27 frontend tests. F-23 flagged |
| T-E. Reconciliation & Anomaly Detection | ☑ Done (2026-09-30) | ☑ Done (2026-09-30) | Team-tier depth (confirmed against Section 1A: tax floor = filing/calc/summary; reconciliation = Team). Daily job + pure anomaly detector, deduped alerts, `GET /tax/reconciliation` gated by `@RequiresFeatures(TaxReconciliation)` + service assert + `hasFeature` job skip. Gating locked by a controller metadata test. Dashboard read-only with month navigator; anomaly alerts labelled in the Alerts tab. 146 backend / 31 frontend tests. F-24 flagged |
| T-F. Multi-Branch Aggregation | ☑ Done (2026-09-30) | ☑ Done (2026-09-30) | Reused the existing `TierFeature.MultiLocation` (Growth) gate + the existing ISP `Router` location dimension (no tax-specific concept), plus a read-only `/tax/aggregate` view and gating-locked controller test. 156 backend / 35 frontend tests. F-25 resolved (headings reconciled to Growth); F-26 (guest-house properties) open |

**How to update:** mirror this table's status in the source doc's own progress tracker at the same time — this table is a convergence view for whoever's issuing prompts, not a replacement for the per-doc trackers the agents themselves update.

---

## Part 5 — What "act as senior engineer" means for whoever issues these prompts

- Issue one layer at a time, in the order above, not the whole backlog at once — each layer's prompt assumes the ones before it are actually merged, not just "in progress."
- Before issuing a Backend prompt, confirm the previous layer's Definition of Done (Section 1.5) was actually met, not just that the agent reported it as done — a self-reported "done" without lint/test/CI evidence isn't done.
- Where a prompt says "confirm directly against current documentation before starting" (Layers P-E, T-A, T-C), that instruction exists precisely because this doc set was written at a point in time and some of what it asserts about external systems (Paystack, KRA) could have shifted — treat those as load-bearing verification steps, not boilerplate caution to skim past.
