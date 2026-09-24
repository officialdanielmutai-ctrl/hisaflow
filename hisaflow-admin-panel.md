# HisaFlow — Internal Admin Panel: Design & Implementation Guide

**Status:** Ready for review, pending open decisions in Section 9
**Depends on:** Clerk (auth/user directory), LiteLLM (AI provider routing), Paystack integration (`hisaflow-paywall.md`)
**Purpose:** A single internal surface where any HisaFlow team member — regardless of coding ability — can manage, support, and operate every account and every underlying service, without touching code or a database console. This doc treats the panel itself as a product: designed, phased, and audited to the same standard as anything customer-facing.

---

## 1. Design principles (read before building any module)

- **One point of convergence.** Every module below lives inside one panel, one login, one navigation — not a scattered set of provider dashboards an admin has to remember to check separately.
- **No code required for any routine action.** If a task described here still requires an engineer to run a script or query, that module isn't done.
- **Power requires accountability.** Every module that changes state (freezes an account, switches a provider, sends a campaign) is gated by role and writes an audit entry. This is not friction for its own sake — it's what makes it safe to let non-engineers operate the panel at all. See Section 2.
- **Reuse platform primitives, don't reinvent them.** Where Clerk or LiteLLM already solve a piece of this natively, the panel wraps and surfaces that capability rather than rebuilding it. Section 4 (account freeze) and Section 5 (AI provider switching) are both built this way.

---

## 2. Foundation: RBAC & audit logging

*This is Phase 0 — nothing else in this doc should be built before this exists.*

**Roles (starting set — extend as needed, don't over-design up front):**
- **Super Admin** — full access, including role management itself.
- **Support Admin** — account lookup, freeze/unfreeze, message observability, work allocation.
- **Billing Admin** — the Billing module (Phase F of `hisaflow-paywall.md`).
- **Marketing Admin** — bulk comms and campaigns only; no account-freeze or message-observability access.

**Data model:**
- `AdminUser` — panel users, distinct from HisaFlow customer accounts, with a role assignment.
- `AdminAuditLog` — one row per state-changing action: admin, action type, target (org/subscriber/campaign/etc.), timestamp, and a reason field where the action type requires one (message viewing, manual account actions).

**Done when:** Every module below writes to `AdminAuditLog` for its state-changing actions, and a Super Admin can view a filterable audit trail (by admin, by action type, by date range) before any other module is considered complete — this is a cross-cutting requirement, not a standalone phase to finish later.

---

## 3. Panel layout

Standard internal-tool convention — familiar beats clever here, since the audience is your own non-technical team, not customers you're trying to impress:

- **Persistent left sidebar**, grouped by module (Accounts, AI Providers, Messages, Communications, Marketing, Work Queue, Billing, Audit Log), not a flat list.
- **Top bar:** global search (find an org/subscriber by name, email, or phone — the fastest path into most support tasks), current admin's identity and role visible at all times.
- **Dashboard home:** KPI cards on load — active orgs, orgs in `GRACE` status needing attention, open work-queue items, recent signups — the "walk in and see what needs attention" view, not a blank landing page.
- **List → detail pattern** for every module with records (accounts, campaigns, work items): a searchable/filterable list, opening into a detail view with the relevant actions for that record. Consistent across modules so an admin who's learned one learns them all.

---

## 4. Module: Account & Organization Management

**Capabilities:**
- Search/browse all organizations and subscriber accounts.
- View plan, seat usage, subscription status (cross-linked to Billing/Phase F), and Clerk-sourced user list for that org.
- **Freeze / unfreeze** — built on Clerk's native `banUser()` / unban Backend API methods, not custom auth logic. Ban revokes all active sessions and blocks sign-in immediately; unban reverses it. The panel surfaces this as a button — the actual mechanism is Clerk's, which is the correct call given Clerk is already the auth system of record.
- **View-as / impersonation** (for support troubleshooting) — gated to Support Admin+ and always audit-logged with a required reason, same pattern as Section 6.

**Done when:** A Support Admin can find any account by search, see its live status pulled from Clerk (not a stale cached copy), and freeze/unfreeze it — with the action appearing in the audit log within the same request.

---

## 5. Module: AI Provider Management (LiteLLM)

**Two build options — start with the first, target the second:**

- **Option A (fast path):** Deep-link Super Admins to LiteLLM's own built-in proxy admin UI (served at the proxy's `/ui` route), which already supports managing providers, models, keys, and routing without code. Ship this first if provider-switching is needed sooner than the full panel.
- **Option B (target state):** A native "AI Providers" module inside the HisaFlow panel that calls LiteLLM's config API under the hood — add/remove providers, reorder fallback priority, set per-model budgets — so switching providers never requires leaving the HisaFlow panel or touching a config file.

**Done when (Option B):** An admin can add a new provider, reorder fallback priority, and see the change reflected in live traffic routing — entirely from the HisaFlow panel, with the underlying LiteLLM config updated via API rather than a manual file edit.

---

## 6. Module: Message/Conversation Observability

**Design stance:** Admins get full visibility into an account's message history — this module isn't watered down — but access is **permissioned and audit-logged**, not unrestricted silent browsing. This is the same pattern Slack, Zendesk, and Intercom all use for internal access to customer data, and it's what makes this defensible when a customer asks who looked at their data and why — not a limitation on capability, a requirement for it to hold up under scrutiny.

**Capabilities:**
- Gated to Support Admin+ (not Marketing Admin).
- Viewing a specific account's message/conversation history requires selecting a reason (e.g. "open support ticket," "abuse investigation") at the point of access — this reason is what lands in `AdminAuditLog`, not a separate step to remember.
- A per-account "recently viewed by" trail visible to Super Admins, so unusual access patterns (an admin repeatedly viewing accounts unrelated to any open ticket) are visible, not just theoretically logged.

**Done when:** An admin cannot open an account's message history without the reason prompt firing and the resulting audit entry being queryable by a Super Admin afterward.

---

## 7. Module: User & Email Directory

- Pulled live from Clerk's Users API — not a duplicated local copy that can drift out of sync with the actual auth system.
- Searchable by name, email, org.
- Feeds the recipient list for Module 8 (bulk comms) — segment by Clerk-sourced attributes (org, plan tier from the Billing module) rather than maintaining a separate marketing contact list.

**Done when:** The directory reflects a Clerk-side change (new user, email update) without a manual sync step.

---

## 8. Module: Bulk Communications (Email/SMS)

**Delivery providers:** an email provider for the email side; **Africa's Talking** for SMS — the standard local provider for this market, both for delivery reliability and cost, rather than a global SMS API with weaker Kenya routing.

**Non-negotiable compliance plumbing** (this is the part that separates a real build from a toy one):
- Per-recipient **opt-out/consent status** as a real, enforced field — not a courtesy checkbox. Kenya's Data Protection Act treats marketing-consent violations as a compliance issue, not just a best practice, so a send that ignores opt-out status is a real liability, not a UX nitpick.
- Every bulk send excludes opted-out recipients at the query level (can't accidentally include them by forgetting a filter in one campaign).
- Delivery status tracking (sent/delivered/failed) per recipient, so a failed SMS batch is visible, not silently lost.

**Done when:** A test bulk send correctly excludes a deliberately opted-out test recipient, and delivery status for every recipient in the batch is visible after sending.

---

## 9. Module: Marketing Campaigns

*A distinct module from Section 8's raw sender — a campaign manager, not just a "send to everyone" button.*

- **Audience segmentation** — by plan tier, vertical (`businessType`), account status, or custom filters built on the directory in Module 7.
- **Campaign builder** — template library, scheduling (send now / send later).
- **Performance metrics** — delivered/opened/clicked per campaign, so campaigns are measurable, not fire-and-forget.

**Done when:** A campaign can be built against a segment (e.g. "all Solo-tier ISP orgs"), scheduled, sent, and its delivered/opened/clicked numbers reviewed afterward.

---

## 10. Module: Work Allocation (internal)

For HisaFlow's own team, not the ISP vertical's customer-facing work orders (that's a separate, already-scoped product feature). This is an internal queue: a flagged account, an open support case, or an escalation gets assigned to a specific admin with status tracking (Open/In Progress/Resolved) — same operating discipline as the ISP vertical's `WorkOrder`, scoped instead to your own team's workload.

**Done when:** An item can be created, assigned to an admin, and tracked to resolution from the panel, with assignment history visible.

---

## 11. Module: Billing (cross-reference)

Fully scoped already as **Phase F** in `hisaflow-paywall.md` (read-only payment/subscription visibility, manual retry/grace-extension actions, reconciliation view). Not duplicated here — this panel's navigation should simply surface it as the "Billing" section, sharing the same `AdminAuditLog` foundation from Section 2.

---

## 12. Explicitly out of scope for the first build

- Fully custom RBAC UI for defining arbitrary new roles — ship the fixed starting role set (Section 2) first; a role-builder UI is a genuine v2.
- Predictive/automated marketing (churn-prediction-triggered campaigns) — v2, once Module 9 has real usage data.
- Building a custom LLM provider config system instead of using LiteLLM's — Option B in Section 5 still calls LiteLLM's own API; this panel is a control surface, not a replacement for LiteLLM itself.

---

## 13. Open questions — need answers before build starts

1. **Reason taxonomy for message-viewing access** (Section 6) — a fixed dropdown ("Support ticket," "Abuse investigation," "Billing dispute") or free text? Fixed options are more auditable; free text is more flexible. Needs a decision, not an assumption.
2. **Email provider choice** — not yet selected; needs the same due-diligence treatment given to Paystack before committing.
3. **Impersonation ("view-as") scope** — full account access as that user, or a restricted read-only view? This materially changes both the risk profile and the audit requirements around Section 4's impersonation feature.
4. **Role set finality** — confirm the four starting roles in Section 2 cover the actual team structure before building permission checks around them.

---

## 14. Progress tracker

| Module | Layer | Status | Notes |
|---|---|---|---|
| Open Questions 1–4 | Decision | ☐ Not started | Blocks all modules below |
| 2. RBAC & Audit Log | Data model | ☐ Not started | Foundation — build first |
| 2. RBAC & Audit Log | API | ☐ Not started | |
| 2. RBAC & Audit Log | Frontend | ☐ Not started | |
| 4. Account Management | API | ☐ Not started | Freeze/unfreeze via Clerk `banUser`/unban |
| 4. Account Management | Frontend | ☐ Not started | |
| 5. AI Providers — Option A | Frontend | ☐ Not started | Deep-link to LiteLLM `/ui` |
| 5. AI Providers — Option B | API | ☐ Not started | Wraps LiteLLM config API |
| 5. AI Providers — Option B | Frontend | ☐ Not started | |
| 6. Message Observability | API | ☐ Not started | Reason-gated, audit-logged |
| 6. Message Observability | Frontend | ☐ Not started | |
| 7. User/Email Directory | API | ☐ Not started | Reads live from Clerk |
| 7. User/Email Directory | Frontend | ☐ Not started | |
| 8. Bulk Communications | API | ☐ Not started | Opt-out enforcement is non-negotiable |
| 8. Bulk Communications | Frontend | ☐ Not started | |
| 9. Marketing Campaigns | Data model | ☐ Not started | |
| 9. Marketing Campaigns | API | ☐ Not started | |
| 9. Marketing Campaigns | Frontend | ☐ Not started | |
| 10. Work Allocation | Data model | ☐ Not started | |
| 10. Work Allocation | API | ☐ Not started | |
| 10. Work Allocation | Frontend | ☐ Not started | |
| 11. Billing | — | See `hisaflow-paywall.md` Phase F | Cross-referenced, not duplicated |

**How to update:** same convention as the ISP and paywall docs — mark `In progress` when work starts, `Done` once merged, with a note. Section 2 (RBAC & audit log) must be `Done` before any other module's work begins, since every other module's "done when" criteria assumes it exists.

---

## 15. Guidance for the agent picking this up

- Build Section 2 first, completely, before starting any other module — every subsequent "done when" in this doc assumes `AdminAuditLog` and role gating already exist. Building a module's happy path first and "adding audit logging later" is how it quietly never gets added.
- For Sections 4 and 5, resist the urge to build custom account-freeze or provider-switching logic from scratch — the whole point of those two designs is that Clerk and LiteLLM already do the hard part correctly; the panel's job is to be a well-designed control surface over them, not a replacement.
- Section 6 is the module most likely to get simplified under time pressure ("we'll add the reason prompt later") — don't. The reason-gating and audit trail are the feature, not an add-on to it.
- Do not start build until Section 13's open questions are answered.
