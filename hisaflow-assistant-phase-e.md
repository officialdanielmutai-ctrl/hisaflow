# HisaFlow — Assistant Redesign: Phase E Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E.
**Status:** Communicate tools + fallback capture implemented; every vertical except chemist ported — ISP, guest-house, school, wholesaler and restaurant (see the per-vertical notes). Remaining vertical still pending (see §4).
**Date:** 2026-10-12 (ISP + guest-house + school + wholesaler + restaurant continuations same day).
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
- Gates: backend `tsc` + **94 suites / 665 Jest tests** + `nest build` + module ESLint; frontend `tsc` + ESLint (assistant clean) + **140 vitest** + `next build`.

## 4. Remaining (next layers)
- **Remaining vertical** (chemist): its P0 tool set is not yet ported. The communicate + fallback + flag + executor + UI layers are now vertical-agnostic, so it is "add tools + tests + an arrangement of suggestions". **ISP, guest house, school, wholesaler and restaurant are done** — see `hisaflow-assistant-isp-vertical.md`, `hisaflow-assistant-guesthouse-vertical.md`, `hisaflow-assistant-school-vertical.md`, `hisaflow-assistant-wholesale-vertical.md` and `hisaflow-assistant-restaurant-vertical.md`.
- **Per-customer consent store** (see the limitation above).
- Live e2e/screenshots + streaming (carried over from Phase D).
- Phase F: injection/abuse suite, cost/rate controls, live eval baselines, retirement of the per-vertical capability prompts.
