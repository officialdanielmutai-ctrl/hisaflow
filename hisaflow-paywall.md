# HisaFlow — Paywall Design & Implementation Guide

**Status:** Ready for review, pending the open decisions in Section 7
**Depends on:** Monetization & Packaging Strategy doc (tier structure), Paystack selected as payment processor
**Purpose:** Define the paywall's design, the three-tier packaging, and a fact-checked Paystack integration architecture, phased for build. Every technical claim about Paystack/M-Pesa behavior below was verified against current documentation before being included — none of it is assumed from general SaaS pattern knowledge.

---

## 1. The three packages (recap, finalized structure)

| Tier | Persona | Seats | Feature depth |
|---|---|---|---|
| **Solo** | Single owner-operator, one location | 1 (owner only) | Core inventory/invoicing/reporting + one active vertical module at base depth |
| **Team** | Owner with staff needing their own logins | Base allowance included (e.g. 3), additional seats billed per extra user | Everything in Solo + role-based permissions + full vertical module depth (e.g. ISP work orders assigned to specific technicians) |
| **Growth** | Multi-location / multi-site operation | Higher/unlimited | Everything in Team + multiple organization/location contexts (e.g. multiple ISP `Router` POPs, multiple guest-house properties) + priority support |

**Pricing figures (KES per tier, per seat overage rate) are intentionally left blank in this doc** — that's a business decision requiring input on target margins and competitor pricing, not something to fabricate. Fill in before Section 7's sign-off.

---

## 1A. Feature Tiering Matrix: Compliance Floor vs. Depth Layer

*How to decide what goes in Solo vs Team, applied to every feature area — not decided per-tab, decided per-layer within each tab.*

**The rule:** split every feature area into two layers. The **floor** is what a business cannot legally or practically operate without — this layer is identical in Solo and Team, never tier-gated. The **depth layer** is forecasting, analysis, multi-location aggregation, and collaboration features — this is what Team actually charges more for. Tiering by "which tabs exist" instead of this floor/depth split is what produces a Solo tier that feels crippled or a Team tier that feels like padding.

| Feature area | Solo — floor (identical in both tiers) | Team — depth (the actual upsell) |
|---|---|---|
| **Receipts** | Full, compliant receipt on every sale | — (already complete at Solo; nothing to gate here) |
| **Tax** | eTIMS filing on every sale, automatic per-sale tax calculation, "what's owed this period" summary | Reconciliation dashboard (filed vs. collected), anomaly flags ahead of filing deadlines |
| **Inventory** | Stock tracking, reorder alerts, transaction log | The "intelligence" layer — demand forecasting, slow-mover analysis, vertical-specific consumption analytics (guest-house per-booking usage, ISP equipment-loss patterns) |
| **Finance** | Cash flow snapshot, basic P&L | Trend/period comparisons, accountant-ready exports, tax liability forecasting |
| **Staff/Seats** | 1 user (owner only) | Multi-seat, role-based permissions |
| **Vertical modules** (guest-house, ISP, etc.) | Base feature set for the org's `businessType` | Full depth (e.g. ISP work orders assigned to specific technicians — meaningless with only one login) |

> Multi-branch aggregated filing (Phase F) is **Growth**, not Team: it reuses the same multi-location capability as the ISP vertical's second `Router` and the guest-house multi-property case (Section 1), so a single-location team does not pay for it.

**Why tax specifically sits entirely in the floor, not as a Team upsell:** tax compliance is a legal requirement regardless of business size — a solo duka owner is exactly as obligated to file correctly as a five-person team. Gating eTIMS filing behind Team wouldn't make Team more attractive, it would make Solo non-viable as a standalone product, the same failure mode identified in the Veira comparison. The depth layer for tax (reconciliation, anomaly detection, multi-branch aggregation) is genuinely Team-scale work — a solo operator doesn't have multiple branches to aggregate — so the split falls out naturally rather than needing to be forced.

**Applying this test to a new feature going forward:** before adding anything to either tier, ask "is this part of correctly and legally running the business day to day" (floor — goes in both) or "is this about scale, forecasting, or more than one person acting" (depth — Team only). A feature that doesn't clearly answer one of those two questions probably isn't ready to be tiered yet.

---

## 2. Paywall design

### 2.1 Entry points
The paywall needs to appear at more than one moment, each with different messaging — don't build a single generic "upgrade" page:

- **Post-signup, pre-first-use** — after the onboarding flow (the existing `page.tsx` onboarding screen), before the org can use the product, for orgs that don't start on a free trial (see Open Question in Section 7).
- **In-context feature lock** — when a Solo-tier user tries an action gated to Team/Growth (e.g. adding a second staff account, or adding a second `Router` in the ISP vertical), show the paywall *from that action*, not a generic pricing page — the context of "I was trying to do X" should carry through, since that's what actually converts.
- **Billing settings** — a persistent place to view current plan, seats used, and upgrade/downgrade, independent of being triggered by a lock.

### 2.2 Layout
- Three tier cards side by side (single column, stacked, on mobile — the primary device for this audience per earlier research).
- **Team** visually marked as the recommended tier (border highlight or "Most Popular" badge) — the standard middle-anchor pattern, not decorative.
- All-in pricing shown up front on each card — no price revealed only at a later step.
- Each card lists what's *included*, not just a feature checklist copied across tiers — the differentiator (seats, vertical depth, multi-location) should be the visually dominant line on each card, not buried in a bullet list identical in structure to the others.

### 2.3 Payment method selection
- **M-Pesa presented first and most prominently** — primary rail for this audience, not one of several generic options.
- **Card (Visa/Mastercard) as a clearly available secondary option**, not hidden behind a "more options" toggle.
- The method selection screen should set the visitor's expectation correctly for what happens next — see 3.3, since the M-Pesa flow through Paystack has a real extra step versus a raw Daraja STK push, and hiding that leads to confused users mid-flow.

### 2.4 Post-payment state
- Immediate on-screen confirmation once the webhook (see Section 4) confirms success — don't rely on the customer's own M-Pesa SMS as the only confirmation signal.
- A visible "payment pending" or "waiting for confirmation" state for the gap between STK prompt sent and webhook received — this gap is real and expected, not an edge case to paper over.
- Clear failure/retry messaging if the prompt is cancelled, times out, or the phone is unreachable — with an immediate retry action, not a dead end.

---

## 3. Payment architecture — fact-checked

This is the section where getting it wrong is expensive, so every claim here is sourced against current Paystack documentation, not assumed.

### 3.1 Card payments — true recurring billing
Paystack supports genuine automatic recurring billing for cards through its native **Plan** and **Subscription** objects: the customer authorizes a charge once (standard card checkout), Paystack stores the authorization, and automatically charges it again at the plan's defined interval without further customer action. This is the "set and forget" behavior — **and it is only available for card payments.**

### 3.2 M-Pesa payments — confirmed NOT eligible for native recurring
Paystack's own support documentation states directly: **it is currently not possible for customers to make recurring payments through the Pay with M-PESA channel.** This confirms and hardens the constraint already established in the Monetization Strategy doc — it's not just a general M-Pesa-industry limitation, it's an explicit, documented limitation of the Pay with M-PESA channel specifically as implemented by Paystack.

**Implication:** M-Pesa subscribers cannot use Paystack's Subscription object at all. HisaFlow must implement its own renewal loop for M-Pesa subscribers — a scheduled job that triggers a fresh Charge API call each billing cycle, exactly as scoped in Section 4 of the Monetization Strategy doc (reminder → renewal window → charge attempt on due date → retry → grace period). This is not optional engineering — it's the only way M-Pesa billing can work on this processor.

### 3.3 The M-Pesa flow through Paystack has an extra step — reflect this in the UI
With direct Safaricom Daraja integration, a merchant sends an STK push and the prompt appears on the customer's phone immediately. Through Paystack, the flow has one additional step: the customer completes Paystack's checkout page first (selecting M-Pesa, entering their phone number), and only then receives the STK prompt. This is a real, user-facing difference from a "pure" M-Pesa experience — the paywall's M-Pesa flow description (2.3) should set this expectation rather than implying an instant prompt with no intermediate screen.

### 3.4 Webhooks — the authoritative payment signal
Do not treat the client-side checkout completion as confirmation of payment. Paystack's webhook is the authoritative signal, and it must be handled correctly:

- **Signature verification is mandatory, not optional.** Paystack signs every webhook with an **HMAC-SHA512** digest of the **raw** request body, keyed with your secret key, sent in the `x-paystack-signature` header. Verify against the raw body — parsing the JSON first and re-serializing it before verification is a common mistake that breaks the signature check.
- **Use a timing-safe comparison** (e.g. `crypto.timingSafeEqual` in Node) rather than a plain string equality check, to avoid timing-attack signature guessing.
- **Respond `200` immediately**, within Paystack's ~30-second timeout, then process the event asynchronously — don't do slow work (DB writes, downstream calls) before acknowledging receipt.
- **Design for retries and duplicates.** Paystack retries failed/unacknowledged webhooks roughly every 3 minutes for the first 4 attempts, then hourly for up to 72 hours (live mode). Webhook handling must be **idempotent** — process the same `charge.success` event twice without double-crediting a subscription — keyed on Paystack's transaction reference, not assumed to arrive exactly once.
- **Key events to handle:** `charge.success` (a payment — card or M-Pesa — completed), `subscription.create` / relevant subscription lifecycle events (card auto-renewals), and failure-side events for the M-Pesa manual renewal loop's retry logic.
- **Optional defense-in-depth:** Paystack also publishes the fixed source IPs its webhooks originate from, which can be used as a secondary check alongside signature verification — not a replacement for it.

---

## 4. Data model

Consistent naming matters here specifically because HisaFlow already has an ISP-vertical `ServicePlan` entity — don't let "plan" become an overloaded, ambiguous term across two different billing contexts in the same codebase.

| Entity | Purpose |
|---|---|
| `HisaflowPlan` | Solo / Team / Growth — HisaFlow's own subscription tiers. Deliberately named distinctly from the ISP vertical's `ServicePlan`. |
| `Subscription` | Per-organization: current `HisaflowPlan`, seat count/allowance, status (`ACTIVE` / `GRACE` / `SUSPENDED`), payment method on file (`CARD` / `MPESA`), next renewal date, Paystack subscription code (card path only — null for M-Pesa). |
| `PaymentAttempt` | One row per renewal attempt (both card auto-charges and M-Pesa manual-loop charges): amount, method, Paystack transaction reference, status (`PENDING` / `SUCCESS` / `FAILED`), attempt number, timestamp. This is the audit trail that resolves "I paid but I'm still locked out" support tickets — not optional polish, same principle as the `RouterAction` audit model from the ISP Phase 6 doc. |
| `WebhookEvent` | Raw log of every verified webhook received (event type, Paystack reference, processed timestamp, idempotency key). Exists specifically to make duplicate-delivery handling provable/debuggable, not just theoretically idempotent. |

---

## 5. Execution phases

### Phase A — Paystack Foundation
**Data model:** `HisaflowPlan`, `Subscription`, `PaymentAttempt`, `WebhookEvent`.
**API:** Paystack SDK integration; webhook endpoint with signature verification (Section 3.4) built and tested before anything else — get this right first, since every other phase depends on trusting this signal.
**Frontend:** none yet.

**Done when:** A test webhook (Paystack's dashboard supports sending test events) is received, verified, logged to `WebhookEvent`, and acknowledged within the timeout — proven with an intentionally invalid signature also being correctly rejected, not just the happy path.

### Phase B — Card Subscriptions (native recurring)
**How it works:** One Paystack `Plan` is created per `HisaflowPlan` tier (Solo/Team/Growth), priced in KES on a monthly interval. Checkout uses Paystack's standard checkout flow with the plan code attached — this single step both charges the first cycle and creates the Paystack `Subscription`, which is what makes true silent auto-renewal possible for card customers. From there, HisaFlow's role is almost entirely webhook consumption rather than orchestration: `subscription.create` confirms the subscription exists on Paystack's side, `charge.success` on each renewal updates `Subscription.status`/`nextRenewalDate`, and `invoice.payment_failed` is the signal that moves the org into `GRACE` — Paystack runs the renewal attempts, HisaFlow reacts to the outcome.
**API:** Create Paystack `Plan`s matching `HisaflowPlan` tiers; checkout flow that captures card authorization and creates a Paystack `Subscription`; webhook handlers for subscription lifecycle events updating HisaFlow's own `Subscription` row.
**Frontend:** Paywall page (Section 2) with card as a selectable method; billing settings page showing current plan/status.

**Done when:** A test-mode card subscription auto-renews on schedule without manual intervention, and a simulated failed renewal correctly moves the org into `GRACE` status.

### Phase C — M-Pesa Manual Renewal Loop
**How it works:** This is the phase HisaFlow drives end-to-end, since Paystack does not run recurring attempts for M-Pesa (Section 3.2). Per active M-Pesa `Subscription`, the scheduled job tracks where it sits relative to its renewal date: a reminder fires a few days out (in-app, and ideally SMS, since a reminder needs to reach someone who may not check the app daily); on the due date, the job calls Paystack's Charge API with the subscriber's phone number, triggering the STK-via-Paystack prompt (3.3); the outcome — success or failure — is logged to `PaymentAttempt`. A failure isn't terminal: retry with backoff, following the same pattern already established for the ISP vertical's `RouterAction` retries (Section 4 of `hisaflow-isp-phase6-mikrotik.md`) rather than inventing a second retry convention in the same codebase. Only after retries are exhausted does the org move to `GRACE`, with a further window before actual feature lockout. At any point, an org's state is really just "where in this sequence" — reminder sent, charge pending, succeeded, retrying, grace, locked — which is what `PaymentAttempt` plus `Subscription.status` together need to represent.
**API:** Scheduled job (mirroring the ISP vertical's cron patterns) that, per active M-Pesa `Subscription` approaching its renewal date: sends a reminder, then on the due date calls Paystack's Charge API with the subscriber's phone number to trigger the STK-via-Paystack flow (3.3), logs a `PaymentAttempt`, and retries with backoff on failure per the grace-period design from the Monetization Strategy doc.
**Frontend:** M-Pesa paywall flow reflecting the extra checkout-page step (3.3); reminder notifications; grace-period messaging in the app when a renewal is overdue.

**Done when:** A test M-Pesa subscription correctly triggers a renewal charge on its due date, and a deliberately failed/cancelled prompt results in the correct number of retries followed by `GRACE` status, not silent lapse or immediate hard lockout.

### Phase D — Seat & Tier Enforcement
**How it works:** Two independent checks, both firing at the moment of the action rather than as a background sweep. A **seat check** runs when someone tries to add a staff account — current Clerk-org member count against `Subscription.seatAllowance`. A **tier check** runs when someone hits a tier-gated capability — this is a natural extension of a pattern that already exists in the codebase, since `businessType` already gates which vertical module a user sees; tier becomes a second dimension on the same kind of gate, not a new mechanism. The part that matters most here: when either check fails, it must not dead-end into a generic pricing page — it routes straight into the paywall with the specific blocked action still attached, which is what makes Section 2.1's "in-context feature lock" a real behavior rather than a design intention that never gets implemented.
**API:** Enforce seat limits per `Subscription` tier (block adding a staff account beyond the allowance without an upgrade or seat add-on charge); enforce feature gating per tier (extending the existing `businessType` vertical-gating pattern with a tier dimension).
**Frontend:** In-context paywall triggers (2.1) firing from the actual locked action, not just a standalone pricing page.

**Done when:** Attempting a Team/Growth-gated action on a Solo-tier org correctly routes to the paywall with the triggering context preserved (e.g. "add a staff account" lands on a paywall that explains *that* limit specifically).

### Phase E — Billing Management UX
**How it works — and the constraint that shapes it:** Paystack's documented endpoints expose `Plan` (create/list/fetch/update) and `Subscription` (create/list/fetch/enable/disable) — there is no dedicated change-plan or upgrade/downgrade endpoint. **Confirm this against current Paystack docs before building**, since it's the load-bearing assumption for this entire phase, but as of this doc, self-serve tier changes have to be built as disable-the-old-subscription-and-create-a-new-one, not a single "change plan" call with built-in proration.

Rather than building manual proration math to compensate, the recommended pattern is **asymmetric by direction**, which mirrors how other platforms handle the same missing-proration situation: an **upgrade takes effect immediately** — new Paystack `Subscription` created right away on the higher plan, full price for the new cycle, no partial-period refund calculation required. A **downgrade is scheduled for the end of the current billing period** — the org stays on its current tier until the existing cycle's renewal date, then the new (lower) subscription is created at that point. This avoids building proration logic entirely, at the honest cost of an upgrading customer not being credited for unused time on their old plan — a reasonable trade for a first version, and one to state plainly to the business side rather than leave implicit.
**Frontend:** Self-serve upgrade/downgrade, seat add/remove, payment method change, invoice/receipt history (pulled from Paystack's Transactions list for the org).

**Done when:** An org can move between tiers and adjust seats without support intervention, with upgrades taking effect immediately and downgrades correctly deferred to the next renewal date rather than either being silently mishandled.

### Phase F — HisaFlow Admin Panel
*Not optional polish — this is how the audit trail from Section 4 actually gets used. Without it, `PaymentAttempt` and `WebhookEvent` are data nobody can act on.*

Scope this incrementally, same discipline as everything above — start read-only, add actions once the read-only view proves useful.

**F1 — Read-only visibility**
**API:** Internal-only endpoints (gated to an admin role, not exposed to org users) to search organizations and view their `Subscription`, `PaymentAttempt`, and `WebhookEvent` history.
**Frontend:** An internal admin surface — a locked section of the existing app, not a separate product — with org search, subscription status at a glance, and the payment/webhook history for a selected org.

**Done when:** Given a support ticket ("I paid but I'm locked out"), an admin can find the org, see every payment attempt and webhook received for it, and determine what actually happened — without touching the database directly.

**F2 — Manual actions**
**API:** Endpoints (admin-role gated, and logged — every manual action here should itself write an audit row, since this is exactly the kind of override that needs its own trail) for: force-retry a failed M-Pesa charge, manually extend a grace period, manually adjust seat count for a negotiated case.
**Frontend:** Action buttons on the org detail view built in F1, each requiring explicit confirmation.

**Done when:** An admin can resolve the "stuck renewal" scenario end-to-end from the panel — retry the charge or extend grace — without a manual database edit, and that action is itself recorded (who did it, when, why).

**F3 — Reconciliation view (stretch, not required for Phase F sign-off)**
A side-by-side view comparing a given org's HisaFlow subscription state against Paystack's own dashboard state for the same org, to catch drift between the two systems the same way the ISP vertical's Phase 6e reconciliation job catches router drift. Useful once real volume exists; not required to ship Phase F.

---

## 6. Explicitly out of scope for this build

- Annual billing (deferred per the Monetization Strategy doc's recommendation to default to monthly for this market).
- Free trial mechanics — blocked on the Open Question in Section 7; do not build trial logic speculatively before that's decided.
- Dunning beyond the grace-period/retry loop already scoped in Phase C (e.g. win-back email campaigns, churn-prediction) — genuine v2 territory.
- Any payment rail beyond Paystack (card + M-Pesa) — PayPal and direct Daraja both remain out of scope per the earlier decision.

---

## 7. Decisions — defaulted to industry standard, revisit if the business wants otherwise

Per direction: unresolved open questions are defaulted rather than left blocking. These are provisional, not final — update if data or the business says otherwise, but they unblock Phase A now.

1. **Pricing:** Solo — KES 2,500/month. Team — KES 5,500/month. Per the market-comparable research already done (Section 1A context, and the pricing-advice discussion this doc's history is built on). Provisional pending real customer willingness-to-pay validation.
2. **Free trial:** 14 days, full Team-tier feature access during the trial (industry-standard "trial the top tier" pattern — shows full value before the customer picks a tier), no payment method required upfront to start. Converts to the customer's chosen tier (or lapses to no access) at trial end.
3. **Grace period:** 5 days from the missed due date to feature lockout, with retry attempts at day 0 (due date), day 2, and day 4 — a standard SaaS dunning cadence, not an aggressive one, appropriate given the M-Pesa approve-per-cycle friction already scoped in Phase C.
4. **Seat overage:** auto-bill the additional seat at the next cycle rather than blocking the action — the standard pattern (Slack and most seat-based SaaS default this way) and the friendlier one for a Team-tier customer who's actively growing.
5. **NOT defaulted — this is a factual check, not a policy choice:** Section 3.2's claim that Paystack has no native change-plan endpoint must be verified directly against current Paystack docs at the start of Phase E, not assumed indefinitely from this doc.
   - **Verified 2026-09-30 (Phase E):** the assumption **holds**. Paystack's current API reference exposes Plan (create/list/fetch/update) and Subscription (create/list/fetch/enable/disable/generate-update-link) only — there is **no change-plan endpoint and no proration**. (`Update Plan` updates a plan's own details and can apply them to existing subscriptions via `update_existing_subscriptions`, but it is integration-wide, not a per-subscription move between plans.) Phase E was therefore built as disable-old/create-new, per the asymmetric pattern above.

---

## 8. Progress tracker

| Phase | Layer | Status | Notes |
|---|---|---|---|
| Open Questions 1–4 | Decision | ☑ Done (defaulted) | See Section 7 — industry-standard defaults applied |
| A. Paystack Foundation | Data model | ☑ Done (2026-09-29) | `HisaflowPlan`, `Subscription`, `PaymentAttempt`, `WebhookEvent` added to `apps/backend/prisma/schema.prisma`; valid via `prisma validate`/`generate`. `HisaflowPlan` kept distinct from ISP `ServicePlan`. |
| A. Paystack Foundation | API (webhook + verification) | ☑ Done (2026-09-29) | `POST /webhooks/paystack` in `apps/backend/src/modules/paywall` — HMAC-SHA512 over raw body, timing-safe compare, idempotent on Paystack reference. 17 tests incl. explicit invalid-signature rejection. |
| B. Card Subscriptions | API | ☑ Done (2026-09-29) | Paystack Plan provisioning, card checkout (`POST /paywall/checkout`), lifecycle webhook handlers (`subscription.create`, `charge.success`, `invoice.payment_failed`). 33 tests; renewal advances `nextRenewalDate`, failed renewal → `GRACE` +5d. Growth tier is unpriced (not in Section 7) so its Paystack Plan is skipped until the business sets a price. |
| B. Card Subscriptions | Frontend | ☑ Done (2026-09-29) | Paywall page `/paywall` (three tier cards, Team recommended, all-in KES pricing, card checkout → Paystack) + billing settings `/settings/billing`. Mobile-first single column, 3-up on desktop. Context-aware (`?feature=`/`?reason=`) for Phase D. M-Pesa shown first but disabled until Phase C; Growth shown as Custom (unpriced). |
| C. M-Pesa Renewal Loop | API | ☑ Done (2026-09-30) | `MpesaRenewalService` + hourly `MpesaRenewalJob`: reminder 3 days out, Charge API on due date, one `PaymentAttempt` per try, retries at day 0/2/4 (RouterAction audit/retry convention), then `GRACE` +5d. Plus first-charge `POST /paywall/checkout/mpesa`. 50 backend tests incl. deliberate-failure → exactly 3 retries → GRACE. Live Paystack sandbox check still pending (F-02). |
| C. M-Pesa Renewal Loop | Frontend | ☑ Done (2026-09-30) | Paywall M-Pesa flow (`POST /paywall/checkout/mpesa`) with the explicit Paystack-checkout-then-STK-prompt step (3.3); phone capture; post-payment confirmation; in-app reminder/retry/GRACE banner + billing settings messaging (day 0/2/4, 5-day grace). |
| D. Seat & Tier Enforcement | API | ☑ Done (2026-09-30) | `EntitlementsService` + `EntitlementsModule` (global): seat gate in `joinOrganization` (Solo/trial blocked with paywall context; Team/Growth overage allowed + auto-billed when priced), `@RequiresFeatures` handled by the existing `RolesGuard` (Section 1A floor/depth), multi-location gate on the 2nd ISP router. Structured `FeatureLockedException` carries reason/feature/requiredTier/paywallUrl. 70 tests. Rate + trial-expiry still open (F-12/F-13). |
| D. Seat & Tier Enforcement | Frontend | ☑ Done (2026-09-30) | `api-client` surfaces `FeatureLockedError` and routes straight to the backend-supplied `paywallUrl`; the Phase B paywall already renders `?reason=`/`?feature=` context. |
| E. Billing Management UX | API | ☑ Done (2026-09-30) | `BillingService` + `PlanChangeJob` (hourly): upgrade = disable old Paystack subscription → new checkout (immediate); downgrade = `pendingTier`/`pendingPlanEffectiveAt` applied at renewal by the job (card: disable-old/create-new via `POST /subscription`; M-Pesa: local swap so the renewal charges the lower price). Seats (`PATCH /paywall/seats`, overage preserved across tier changes), payment-method change (card manage-link, M-Pesa number, rail switch). Receipts pulled from Paystack's Transactions list (`GET /transaction` by resolved customer id) with a local audit-trail fallback. Paystack client gained fetch/disable/create-subscription, manage-link, customer fetch and transaction list. 14 new tests (84 backend total). Verified Section 7 item 5 against live docs — no native change-plan endpoint. |
| E. Billing Management UX | Frontend | ☑ Done (2026-09-30) | Billing settings now self-serve: change plan (upgrade label = "immediate", downgrade label = "takes effect on [date]" + scheduled-downgrade banner with the date), seat add/remove, payment-method update/switch, receipt history from Paystack's Transactions list (with a "synced from Paystack" / local-fallback indicator). Pure decision helpers in `lib/billing.ts` with 5 node:test cases (13 frontend tests total). Upgrade-abandoned edge case open in F-15. |
| F1. Admin — Read-only visibility | API | ☐ Not started | |
| F1. Admin — Read-only visibility | Frontend | ☐ Not started | |
| F2. Admin — Manual actions | API | ☐ Not started | Each action must itself be audit-logged |
| F2. Admin — Manual actions | Frontend | ☐ Not started | |
| F3. Admin — Reconciliation view (stretch) | API + Frontend | ☐ Not started | Not required for Phase F sign-off |

**How to update:** same convention as the ISP vertical docs — `In progress` when work starts on a row, `Done` once merged with a PR link/date/note. Don't mark a phase's layer done until its "Done when" criteria in Section 5 are actually met.

---

## 9. Guidance for the agent picking this up

- Build and prove the webhook signature verification (Phase A) before writing any code that assumes a webhook payload can be trusted — this is the foundation every other phase's correctness depends on.
- Do not build Phase C (M-Pesa manual renewal) as a variant of Phase B's card logic — they are architecturally different (Paystack-native recurring vs. HisaFlow-owned scheduled charging) and treating them as the same code path with a conditional branch is how subtle billing bugs get introduced. Keep them as separate, clearly-named code paths.
- Section 3.2's finding is load-bearing for the entire M-Pesa side of this feature — if a future Paystack API update changes this limitation, that changes the architecture, not just an implementation detail, so it's worth re-confirming against current Paystack docs before Phase C work begins, not just trusting this doc indefinitely.
- Do not start Phase A until Section 7's open questions have recorded answers in this file.
- Phase F (admin panel) can be built in parallel with C/D/E rather than strictly after them — its F1 read-only view has no dependency beyond Phase A's `PaymentAttempt`/`WebhookEvent` models existing, so there's no reason to leave support staff blind until every customer-facing phase is finished.
