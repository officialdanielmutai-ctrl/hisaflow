# HisaFlow — Assistant Redesign: Phase E Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E.
**Status:** Communicate tools + fallback capture implemented; **all eight live verticals ported** (DUKA, ISP, guest house, school, wholesaler, restaurant, chemist; MINI_MART shares DUKA). Per-vertical notes: `hisaflow-assistant-isp-vertical.md`, `hisaflow-assistant-guesthouse-vertical.md`, `hisaflow-assistant-school-vertical.md`, `hisaflow-assistant-wholesale-vertical.md`, `hisaflow-assistant-restaurant-vertical.md`, `hisaflow-assistant-chemist-vertical.md`. The remaining Phase E items are the per-customer consent store and the live shadow run (see §4).
**Date:** 2026-10-12 (ISP + guest-house + school + wholesaler + restaurant + chemist continuations same day).
**Depends on:** Phase B/C/D (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`).

---

## 1. Communicate tools (consent-checked, proposal only)

| Tool | Kind | Risk | Roles | Behaviour |
|---|---|---|---|---|
| `send_email` | communicate | high | OWNER, MANAGER | Draft `{recipient, subject, message}`; consent checked when the proposal is built and again at commit; sends via Resend (mock mode without a key). |
| `send_sms` | communicate | high | OWNER, MANAGER | Draft `{recipient, message}`; same consent path; sends via Africa's Talking (mock mode without a key). |

- **Proposal-only.** The tools never send during `buildProposal`; the executor sends on commit after approval. Exact recipient and text are in the proposal summary/diff, and high-risk cards require the two-tap confirm (Phase D).
- **Consent/opt-out.** `AssistantCommsService.assertConsent` blocks when a matching `CommunicationConsent` row is `OPTED_OUT` for the channel. `send` re-checks before delivery (precondition re-validation).
- **Delivery trail.** Every send writes an `AssistantOutboundMessage` row (org, user, channel, recipient, subject, body, status `SENT|MOCKED|FAILED`, error).
- **Flag.** Gated by `assistant.communicate` (separate from read/write, per the owner's flag-table decision).

### Known limitation (recorded, not hidden)
`CommunicationConsent` is keyed by Clerk user and is the platform opt-out store. A **per-customer consent store** (for DUKA/School/etc. recipients who are not Clerk users) is a follow-up. Today, recipients absent from `CommunicationConsent` are treated as transactional and allowed; a recorded opt-out is always respected.

## 2. Fallback capture + unsupported-intent logging

- **`log_unsupported_intent`** utility tool: the model calls it when no capability fits, then explains the limit and offers the nearest alternative (system-prompt instruction added).
- Additive `UnsupportedIntent` model + migration `20261013000000_add_assistant_expansion`; the utterance is **redacted** (`redactUtterance`) before storage. No org/user identifier is omitted — it is org-scoped for the team's review but carries no customer PII beyond the redacted text.
- **Surfaced to the team:** `GET /assistant/unsupported` and an owner/manager-only `UnsupportedIntentsCard` on the `/assistant` page (count + recent requests) to drive the tool backlog.

## 3. Tests + gates

- `comms/assistant-comms.service.spec.ts` — phone/email normalisation, opt-out blocks send, mock-mode send records the outbound row, opted-out does not record.
- `unsupported/assistant-unsupported.service.spec.ts` — redaction, empty intent, scoped list.
- `tools/assistant-tools.service.spec.ts` — `send_email`/`send_sms` consent + governed commit; `log_unsupported_intent` utility.
- `components/assistant/UnsupportedIntentsCard.spec.tsx` — empty and populated states.
- `test/assistant-lifecycle.e2e-spec.ts` — real-Postgres coverage: communicate tools send only after approval, honour opt-out consent and record the outbound trail; `log_unsupported_intent` records and `GET /assistant/unsupported` lists it.
- Gates: backend `tsc` + **94 suites / 665 Jest tests** + `nest build` + module ESLint; frontend `tsc` + ESLint (assistant clean) + **140 vitest** + `next build`.

## 4. Remaining (next layers)
- **Vertical parity is complete.** Every live business type now has its P0 tool set: DUKA / MINI_MART (`hisaflow-assistant-phase-b.md`), ISP, guest house, school, wholesaler, restaurant and chemist (per-vertical notes). Phase E's “every live vertical has parity” done-criterion is met at the tool layer.
- **Per-customer consent store** (see the limitation above).
- Live e2e/screenshots + streaming (carried over from Phase D).
- Phase F: injection/abuse suite, cost/rate controls, live eval baselines, retirement of the per-vertical capability prompts.

## 5. Post-phase update (2026-10-14)

Cross-vertical resilience and memory landed after the per-vertical ports: the
gateway call is bounded and provider failures degrade to an honest retryable
reply (never a 500), `create_note` whips up the reviewable note panel, and the
assistant has short-lived, user-scoped conversation memory that is pruned as
chats pile on. See `hisaflow-assistant-resilience-memory-notes.md`
(defects Q-013/Q-014/Q-015).

**Later same day (Q-016/Q-017):** the assistant flags were found to default off
with no production seed, so no tool was offered; read/write/communicate now
default on when no flag row exists, and the shared inventory tools were widened
to every vertical. See `hisaflow-assistant-vertical-enablement.md`.

## 6. Post-phase update (2026-10-15)

Two additions from the rooms/finance/settings upgrade
(`hisaflow-rooms-finance-settings-upgrade.md`):

- **`get_financial_breakdown`** (foundation, all verticals, read-only) exposes
  the new vertical-aware `FinanceBreakdownService`, so the assistant can answer
  revenue/profit/margin/leak questions from live figures.
- **`report_room_issue`** (guest house, manager roles) records a mandatory fault
  note plus optional repair cost and takes the room out of service through
  `RoomsService.reportIssue`.
