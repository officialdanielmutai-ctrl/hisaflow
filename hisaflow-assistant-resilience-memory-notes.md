# HisaFlow — Assistant Redesign: Resilience, Note Panel & Conversation Memory

**Directive:** `hisaflow-quality-and-assistant-overhaul.md` (Duty 2, Section 3.3, 3.6, 3.10) / Prompt D2-E continuation.
**Status:** Implemented, cross-vertical. All local gates green, including the real-Postgres e2e (15/15).
**Date:** 2026-10-14.
**Depends on:** `hisaflow-assistant-phase-b.md`, `-d.md`, `-e.md` (foundation, conversational UI, communicate tools/verticals).
**Defects closed:** Q-013, Q-014, Q-015 (`hisaflow-overhaul-defect-log.md`).

---

## 1. Why this was needed

Production testing surfaced three gaps in the otherwise-working assistant:

1. **“Give me the inventory list” returned an Internal Server Error.** A gateway
   failure, timeout or malformed tool call escaped the agent loop and became a
   500 for the user instead of a helpful answer.
2. **“Send a note” produced a static draft the user could only copy.** There was
   no note panel, and a body-only draft could fail `create_note` validation,
   pushing the model back to pasting plain text.
3. **The assistant had no memory.** A page reload lost the thread and nothing
   pruned old conversations.

All three are fixed in the shared foundation, so every vertical gets them.

## 2. What was built

All backend paths are relative to `apps/backend/src/modules/assistant/`.

| Piece | File | Notes |
|---|---|---|
| Bounded provider call | `provider/assistant-provider.service.ts` | 50s timeout, `maxRetries: 0` (LiteLLM already backs off); malformed/truncated tool calls are skipped, not thrown. |
| Graceful agent loop | `agent/assistant-agent.service.ts` | Catches any provider failure and returns an honest, retryable reply (“I couldn't reach the AI service…”), keeping any proposals already collected. Accepts prior turns as `history` and feeds them to the model. Hardened system prompt with concrete tool-calling examples. |
| Note normalisation | `tools/assistant-tools.service.ts` | `create_note` derives a title from the first line of the body when the model omits it, accepts `body`/`text` aliases, and carries an optional `dueDate`. |
| Conversation memory | `memory/assistant-memory.service.ts` | Durable, org+user-scoped threads and turns; retention (30 days / newest 20 threads per user) pruned every turn; replays only user/assistant text (never tool payloads or identifiers). |
| Chat orchestration | `assistant.service.ts` | `chat()` loads history, appends the user turn, runs the agent, appends the reply, then prunes. |
| API | `assistant.controller.ts` | `GET /assistant/conversations`, `GET /assistant/conversations/:id/messages`; `POST /assistant/chat` accepts an optional `conversationId`. |
| Note panel | `apps/frontend/components/assistant/NoteProposalEditor.tsx` | Renders a `create_note` proposal as the manual New Note form (title, details, importance, due date), prefilled from the draft. **Save note** runs the governed approve → execute path (revising first only when the user edited a field). |
| Panel wiring | `apps/frontend/components/assistant/AssistantPanel.tsx` | Note proposals render the panel; non-note proposals keep the generic card. Restores the current thread per org from `localStorage`, offers **New chat**, and stores the returned `conversationId`. |
| Helpers/client | `apps/frontend/lib/assistant.ts`, `apps/frontend/services/assistant.service.ts` | Note draft ↔ proposal args helpers and the conversation-memory client calls. |

Additive schema (`prisma/schema.prisma` + migration
`20261015000000_add_assistant_memory`): `AssistantConversation`,
`AssistantMessage`. No `Organization` relation; tenant scope is a code-enforced
column, consistent with the rest of the assistant foundation.

## 3. Integrity is unchanged

The single governed write path is untouched:

```
assistant chat → proposals (no write) → user reviews/edits the note panel
             → approve → execute → executor (tenant · argsHash · idempotent) → domain service
```

Memory stores **text turns only** and is pruned automatically. It never stores
proposal arguments, tool payloads or identities, and it is scoped to the
authenticated org **and** user (an org peer cannot read another user's thread —
asserted in the e2e suite).

## 4. Tests + gates

- `provider/assistant-provider.service.spec.ts` — bounded call (timeout, no SDK retries) and malformed/truncated tool-call skipping.
- `agent/assistant-agent.service.spec.ts` — graceful provider failure (no throw), proposals kept after a later failure, prior turns included in the model prompt.
- `tools/assistant-tools.service.spec.ts` — title derivation, `text` alias, due-date normalisation.
- `memory/assistant-memory.service.spec.ts` — scoping, history replay, append, empty-reply skip, retention/cap pruning.
- `components/assistant/NoteProposalEditor.spec.tsx` — prefill, save, edit, empty-title guard, discard, saved state.
- `lib/assistant.spec.ts` — note helpers (`isNoteProposal`, draft round-trips, equality) and datetime conversion.
- `test/assistant-lifecycle.e2e-spec.ts` (real Postgres) — **15/15 pass locally**, including body-only note commits, due-date persistence, conversation memory persisted and user-scoped, and the graceful provider-failure path (the chat returns a retryable reply, not a 500).
- `e2e/tests/assistant-layout.spec.ts` — the note panel stays inside its container with ≥44px actions.

Local gates (Windows, equivalent compilers run directly):

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | Pass |
| Frontend `tsc --noEmit` | Pass |
| E2E `tsc --noEmit` | Pass |
| Backend ESLint (module) | 0 errors |
| Backend tests | **103 suites / 812 tests** |
| Backend `nest build` | Pass |
| Frontend tests | node:test suite + **26 vitest files / 170 tests** |
| Frontend `next lint` | 0 errors |
| Frontend `next build` | Pass |
| Admin tests | 12 tests |
| Backend e2e (real Postgres) | **15/15 pass** |

`prisma validate` passes; CI applies the migration with `prisma migrate deploy`
before the real-Postgres e2e job.

## 5. Remaining / deferred

- **Proposal-aware memory.** History replays text turns, so a follow-up can
  re-draft but cannot yet edit a *specific pending proposal by reference* beyond
  the Phase D inline editor. Phase A §6.2 sketched a `toolCallsJson` column on
  `AssistantMessage`; it is intentionally **omitted** here so memory never stores
  tool payloads or customer identifiers. Add it only if proposal-aware memory is
  pursued, with the same retention and redaction rules.
- **Retention/consent review.** 30 days / 20 threads is a sensible default;
  revisit with the owner and the data-retention policy.
- Live-model eval/shadow run on the characterization sets and streaming replies
  (carried over from Phases C–E) still need the configured `hisaflow-assistant`
  gateway in staging.
- Per-customer consent store for outbound comms (Phase E §1 limitation).
