# HisaFlow — ISP Vertical, Phase 6: MikroTik Router Integration

**Status:** Design/scoping — not yet approved for implementation
**Depends on:** Phases 1–5 complete (Subscriber, ServicePlan/Billing, Equipment Tracking, Work Orders, Tickets)
**Purpose:** Scope the auto-suspend/reconnect integration properly before writing code. Phase 5 flagged this as needing its own design pass rather than inherited "done when" criteria — this is that pass.

---

## 0. Correction to earlier assumption

The original ISP scope doc described router reachability as a risk because "routers are usually behind NAT on customer sites." That's not the right model for this integration and should be discarded.

The router HisaFlow needs to talk to is **the ISP's own access router** — the MikroTik acting as PPPoE access concentrator / hotspot NAS at the tower or POP — not the customer's home router. This is a device the ISP owns, configures, and can deliberately expose (static IP, port forward, or VPN) for management. The actual risk isn't NAT traversal, it's **credential handling and network exposure of a device that controls live internet service for every subscriber behind it** — treated accordingly below.

---

## 1. What "integration" actually means here

RouterOS exposes a management API (port 8728 plaintext, or 8729 over TLS — API-SSL — which is the only acceptable option for production). Through it, HisaFlow can:

- Create/enable/disable **PPP secrets** (PPPoE subscriber accounts) — this is the primary lever for PPPoE subscribers.
- Create/manage **hotspot users** — for hotspot/voucher subscribers.
- Read/write **Simple Queues** — used for bandwidth shaping per plan, and as an alternative suspension mechanism (throttle to near-zero instead of fully disconnecting).
- Manage **firewall address-lists** — a third suspension mechanism (block a subscriber's IP entirely at the firewall).
- Read **active PPP/hotspot sessions** — for "is this subscriber actually online right now" visibility.

Three viable suspension mechanisms exist (disable PPP secret / throttle via queue / block via address-list). **Pick one as the default before implementation** — see Section 4, Open Question 1.

---

## 2. Data model additions

| Entity | Purpose |
|---|---|
| `Router` | One row per physical/virtual MikroTik device HisaFlow manages. Fields: org reference, site/label name, host/IP, API port, **encrypted** credentials (or reference to a secrets store — never plaintext in the DB), connection status, last-sync timestamp. |
| `Subscriber` (extend) | Add `routerId` (which router this subscriber's account lives on) and `routerAccountRef` (the PPP secret name or hotspot username on that router). |

**Why `Router` is its own entity, not a field on `Organization`:** a single ISP org commonly runs more than one tower/POP, each with its own MikroTik. Modeling it as one-to-many from day one avoids a painful migration later — don't build this as a single `mikrotikHost` field on `Organization`.

---

## 3. Execution sub-phases

Phase 6 is bigger than earlier phases — break it into its own sub-phases with their own "done when" criteria, same discipline as Phases 1–5.

### 6a — Router Connection Management
**Data model:** `Router` entity.
**API:** CRUD for router connections per org; a "test connection" endpoint that attempts an authenticated API call and reports success/failure without changing anything.
**Frontend:** Settings screen to add a router (host, port, credentials), see connection status, test it.

**Done when:** An org admin can register a router and get a clear success/failure signal — no silent failures.

### 6b — Manual Suspend/Reconnect
**API:** Endpoint to suspend/reconnect a specific subscriber's router account on demand, using the chosen mechanism from Open Question 1.
**Frontend:** A suspend/reconnect action on the subscriber detail page, with the *current* live status (from the router, not just HisaFlow's cached belief) shown before the action is taken.

**Done when:** An owner can manually suspend or reconnect a subscriber from the UI, and the UI reflects the router's actual resulting state, not an optimistic guess.

### 6c — Automated Suspend on Non-Payment
**API:** Hook into the existing billing/invoice logic from Phase 2 — when an invoice passes its due date unpaid (or per whatever grace-period rule the business defines), trigger the same suspend action as 6b, automatically.
**Frontend:** Visibility into *why* a subscriber is suspended (manual vs automatic-for-non-payment) — don't let both paths write to the same status field indistinguishably.

**Done when:** An overdue invoice results in the subscriber being suspended on the router without manual action, and reversing on payment (see 6d) reconnects them without manual action.

### 6d — Automated Reconnect on Payment
**API:** Hook into payment recording (Phase 2) — when a payment clears an overdue invoice, trigger reconnect automatically.

**Done when:** Recording a payment against a suspended subscriber's invoice reconnects them on the router within an acceptable delay (define the SLA — e.g. under 60 seconds — before building this, not after).

### 6e — Reconciliation Job
**Purpose:** HisaFlow's belief about a subscriber's status and the router's actual state *will* drift — a manual change made directly in Winbox, a router reboot losing a queued change, a failed API call that wasn't retried. Without a reconciliation job, drift is invisible until a customer complains.
**API:** A scheduled job that periodically compares HisaFlow's subscriber status against actual router state per subscriber and flags (or auto-corrects, per Open Question 3) mismatches.

**Done when:** A manually-introduced mismatch (e.g. someone re-enables a PPP secret directly in Winbox) is detected and surfaced within one job cycle.

### 6f — Live Session Visibility *(stretch, not required for Phase 6 sign-off)*
Read-only view of whether a subscriber is currently connected and passing traffic, pulled from the router's active-sessions list. Useful for support ("are they actually online right now") but not required for the billing-driven suspend/reconnect loop to be considered complete.

---

## 4. Open questions — need an answer before 6a starts

**1. Which suspension mechanism is the default?**
- *Disable PPP secret* — cleanest, fully cuts the session, but the subscriber gets zero warning/no "why am I suspended" page.
- *Throttle via Simple Queue* (e.g. to 64kbps) — subscriber still has a thread of connectivity, can be shown a "please pay" redirect via captive portal — friendlier, but more moving parts and only works cleanly for PPPoE/hotspot where a redirect is feasible.
- *Block via firewall address-list* — coarse, but simple and fast to implement.

Recommendation: start with **disable PPP secret** for the MVP (6a–6d) — it's the simplest to implement and verify correctness of, and matches what most small-ISP billing tools default to per the research. Treat the "friendlier" throttle-with-redirect approach as a genuine v2 candidate, not something to half-build now.

**2. Credential handling and network exposure**
How are router credentials stored (encrypted at rest — confirm the mechanism, don't assume), and how does HisaFlow's backend reach a router that may be sitting on a residential/business ISP connection rather than a properly hosted one? Options: direct API-SSL over the public internet (requires the ISP to port-forward — a real security exposure worth discussing explicitly with early adopters, not glossing over), or a lightweight VPN/tunnel per router. **Decide this before 6a**, since it shapes the `Router` entity's fields (do we need to store VPN config too?).

**3. Auto-correct or just flag, on reconciliation drift?**
Auto-correcting (6e forcing the router back to match HisaFlow) risks fighting a technician who made a deliberate manual change for a reason HisaFlow doesn't know about. Flagging for a human to resolve is safer for a v1. Recommendation: flag only in 6e; revisit auto-correct once the system has a track record.

**4. Failure/retry behavior**
If a suspend/reconnect API call to the router fails (router offline, network blip), what happens? Silent failure is unacceptable — at minimum, log it, retry with backoff, and surface a visible "action pending/failed" state rather than assuming success.

---

## 5. Explicitly still out of scope

Everything from the original ISP scope doc's out-of-scope list still holds (NMS, RADIUS hosting, GIS/tower mapping, bandwidth shaping across multiple towers) — Phase 6 does not expand that boundary. This phase is specifically the billing-status-to-router-state loop, nothing more.

---

## 6. Progress tracker

| Sub-phase | Layer | Status | Notes |
|---|---|---|---|
| Open Questions 1–4 | Decision | ☐ Not started | Blocks all of 6a onward |
| 6a. Router Connection Mgmt | Data model | ☐ Not started | |
| 6a. Router Connection Mgmt | API | ☐ Not started | |
| 6a. Router Connection Mgmt | Frontend | ☐ Not started | |
| 6b. Manual Suspend/Reconnect | API | ☐ Not started | |
| 6b. Manual Suspend/Reconnect | Frontend | ☐ Not started | |
| 6c. Auto-Suspend on Non-Payment | API | ☐ Not started | Depends on Phase 2 invoice due-date logic |
| 6d. Auto-Reconnect on Payment | API | ☐ Not started | Depends on Phase 2 payment recording |
| 6e. Reconciliation Job | API | ☐ Not started | |
| 6e. Reconciliation Job | Frontend | ☐ Not started | Drift alert surface |
| 6f. Live Session Visibility (stretch) | API + Frontend | ☐ Not started | Not required for Phase 6 sign-off |

**How to update:** same convention as the main dev guide — mark `In progress` when work begins on a row, `Done` once merged, with a note (PR link/date/blocker). Do not start 6a until the four Open Questions have recorded answers in this file (replace this note with the decisions once made).

---

## 7. Guidance for the agent picking this up

- Do not start writing code until Section 4's open questions have actual decisions recorded here — this phase is unusually sensitive to getting the architecture right up front, since a mistake here suspends real customers' internet, not just a UI glitch.
- Build 6a and 6b fully, including manual testing against a real (or realistic test) MikroTik device, before touching 6c/6d automation — verify the mechanism works correctly under human control before letting billing events trigger it unattended.
- 6e (reconciliation) is not optional polish — treat it as required for Phase 6 sign-off, not a nice-to-have, given how easily drift becomes invisible otherwise.
