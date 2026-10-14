# HisaFlow — Assistant Redesign: Phase D Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.10 / Prompt D2-D.
**Status:** Implemented (frontend + small backend contract addition). Live e2e / screenshots pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** Phase B/C backend (`hisaflow-assistant-phase-b.md`). First vertical: DUKA (retail).

---

## 1. What was built

| Piece | File | Notes |
|---|---|---|
| API client | `apps/frontend/services/assistant.service.ts` | `getAssistantTools`, `sendAssistantMessage`, `listAssistantProposals`, `approve`, `reject`, `revise`, `execute` |
| Pure helpers | `apps/frontend/lib/assistant.ts` | tool labels, tool-derived suggestion chips, diff-row extraction, status/risk labels+tones, edit coercion |
| Proposal card | `apps/frontend/components/assistant/ProposalCard.tsx` | summary, status/risk badges, before/after diff, Approve/Apply/Edit/Reject/Retry, inline edit, high-risk two-tap confirm, honesty + no-undo note, and a **View in `<section>`** link on executed cards so the user lands on the record the action produced |
| Conversation panel | `apps/frontend/components/assistant/AssistantPanel.tsx` | message list, honest activity chip, multi-action "Review and confirm / Confirm all", per-item actions, suggestion chips, sticky composer |
| Page | `apps/frontend/app/(dashboard)/assistant/page.tsx` | route `/assistant` |
| Navigation | `components/layout/SideMenu.tsx`, `components/layout/BottomNav.tsx` | "Assistant" in the side menu (all verticals) and the retail bottom nav |
| Backend contract | `assistant.controller.ts` `POST /assistant/proposals/:id/revise` | edit creates a **new proposal version** and rejects the superseded one (Section 3.10) |

## 2. Behaviour and honesty rules
- **Proposed vs done.** Proposed/approved cards state "Proposed — not applied until you approve and apply it."; executed cards show the result and "Undo is not available for this action."
- **Approve → Apply are separate steps**, matching the governed write path; multi-action requests get one "Review and confirm" step with per-item Approve/Edit/Reject.
- **Edit re-validates**: the card sends edited args to `/revise`; the backend rebuilds the draft through the tool and creates `version + 1`.
- **High-risk actions** require a second tap ("Tap again to approve/apply").
- **Suggestion chips are generated from the tools returned by `GET /assistant/tools`** — never a hard-coded per-vertical list.
- **Where it went.** On an executed proposal the card shows a `View in <section>` link (Notes, Inventory, Transactions, Bookings, Guests, Rooms, Subscribers, …) derived from the tool name, so an action mirrors the user's request and points at the record it produced (Q-011 follow-up).
- **Activity indicator** is honest ("Working…"). The backend chat is synchronous (no token streaming), so no fake progress is shown; streaming is a follow-up.
- **Accessibility**: 44px minimum targets, `aria-label`s on icon buttons, `role="group"`/`aria-label` on cards, `aria-live="polite"` activity region, `role="alert"` errors, keyboard-safe composer (Enter sends, Shift+Enter newline), sticky composer above the bottom nav.

## 3. Tests + gates
- `lib/assistant.spec.ts` — suggestion generation, diff extraction, status/risk labels, edit coercion.
- `components/assistant/ProposalCard.spec.tsx` — render, approve/apply/retry, high-risk two-tap, executed/no-undo, nested edit with coercion.
- `e2e/tests/assistant-layout.spec.ts` — no horizontal overflow + 44px targets + card containment (skips without `E2E_BASE_URL`, matching the repo pattern).
- `test/assistant-lifecycle.e2e-spec.ts` — real-Postgres contract for the edit path: `POST /assistant/proposals/:id/revise` creates a new version and rejects the superseded proposal, and a rejected proposal can never be approved or executed.
- Gates: frontend `tsc` + ESLint (assistant clean) + **138 vitest** + `next build`; backend `tsc` + **92 suites / 653 Jest tests** + `nest build`; e2e `tsc`.

## 4. Remaining / deferred
- **Live e2e + screenshots** at the Section 2.2 viewports (needs a seeded authenticated org; same deferral as Duty 1 and Phase B/C).
- **Streaming replies** (backend is synchronous today).
- **State coverage** partially done: empty/first-run, error, loading are handled; offline/slow, rate-limited, and tier-gated messaging are explicit follow-ups.
- **Undo/revert**: not offered because the DUKA domain has no revert; the UI says so rather than implying one exists.
- The conversational surface is additive — the legacy `/ai` ingestion page still exists and is retired in Phase F.
