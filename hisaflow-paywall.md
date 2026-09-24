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

## 7. Open questions — need answers before Phase A sign-off

1. **Actual KES pricing per tier**, and the per-seat overage rate for Team/Growth — business decision, not an engineering one.
2. **Free trial:** yes/no, and if yes, length and which tier it grants access to during the trial.
3. **Grace period length** before a `GRACE`-status org is actually feature-locked (the Monetization Strategy doc recommended a grace window generally but didn't fix a number — needs one, e.g. "3 days" or "until 2 failed retries," for Phase C to be buildable).
4. **Seat overage behavior:** does exceeding the included seat count on Team auto-bill the next cycle for the extra seat, or block adding the seat until manually upgraded? This changes both the `Subscription` model and the Phase D enforcement logic.
5. **Confirm Paystack has no native change-plan/proration endpoint** before Phase E begins — this doc's Phase E design assumes that's the case based on Paystack's published endpoint list, but it's worth a direct check against current docs rather than building four weeks of work on a doc's assumption.

---

## 8. Progress tracker

| Phase | Layer | Status | Notes |
|---|---|---|---|
| Open Questions 1–4 | Decision | ☐ Not started | Blocks Phase A |
| A. Paystack Foundation | Data model | ☐ Not started | |
| A. Paystack Foundation | API (webhook + verification) | ☐ Not started | |
| B. Card Subscriptions | API | ☐ Not started | |
| B. Card Subscriptions | Frontend | ☐ Not started | |
| C. M-Pesa Renewal Loop | API | ☐ Not started | Depends on Open Question 3 |
| C. M-Pesa Renewal Loop | Frontend | ☐ Not started | |
| D. Seat & Tier Enforcement | API | ☐ Not started | Depends on Open Question 4 |
| D. Seat & Tier Enforcement | Frontend | ☐ Not started | |
| E. Billing Management UX | Frontend | ☐ Not started | |
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
