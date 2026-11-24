# HisaFlow Assistant Upgrade — Build Brief for Agents

**Read first:** `hisaflow-agent-ground-rules.md` (Part 1). Every rule in it applies to every phase here: required reading, non-regression discipline, lint/type-check/CI gates, tooling, Definition of Done, and backend-before-frontend ordering (with frontend prompts drafted early).

**Status of this document:** it was written from user-reported symptoms, not from reading the assistant's code. Every statement about *why* something fails is a hypothesis. **Phase 0 exists to confirm or kill each hypothesis with evidence before any fix is written.** Do not skip it.

---

## 1. Goal

The assistant should take work off the user across every vertical: report a sale, issue or receive stock, leave a note, book a room, sign in or register a new user, renew a subscriber, and similar, depending on the vertical (`businessType`). A user should be able to say what they want in their own words (English, Swahili, Sheng, shorthand, typos), have the assistant understand it, show a short summary, and complete it with one tap.

### Design principles (non-negotiable)

1. **The model understands; code decides.** The LLM turns a message into structured intent. Deterministic code resolves entities, validates, and executes.
2. **The model never writes business data directly.** Every mutation is a *proposal* stored server-side. Nothing changes until the user approves.
3. **Approval executes a stored proposal by its ID.** The approval step never asks the model to rebuild the payload and never trusts the client to resend it.
4. **Ask less, resolve more.** Ask the user only when ambiguity is real, one question at a time, with tappable options.
5. **Never claim success the server hasn't confirmed.** Confirmation text is built from the server's result, not from model prose.
6. **One code path.** Assistant actions call the same service functions the normal UI endpoints use. No parallel business logic.
7. **Measure before and after.** No performance or accuracy claim without numbers from the eval harness (Phase A).

---

## 2. Reported problems and hypotheses to test

| # | Symptom (as reported) | Hypotheses to test in Phase 0 |
|---|---|---|
| S1 | Reporting a sale takes long to confirm; sometimes the sale is missed entirely | Multi-round LLM loop for a simple flow; model sometimes answers in prose instead of calling the tool; oversized prompt/tool list; slow gateway hop or cold start; tool-call parse failures swallowed silently |
| S2 | Product phrased differently isn't recognised | Product lookup is exact/substring match on the model-supplied string; no alias or fuzzy layer; no handling of plurals, units, language variants; full catalog not reachable or not in context |
| S3 | Approval step errors after the user applies | Approval re-derives the payload instead of executing the stored one; proposal expired or missing; stale validation (stock/price changed); auth/org context lost between request and approval; schema mismatch between proposal and execute endpoints; non-idempotent retry; error not surfaced to the user |
| S4 | A new sale request sometimes submits the previous sale | "Latest pending" lookup instead of ID-based approval; drafts keyed per conversation not per proposal; cache key collision (Redis or in-memory); old tool calls/results in history being re-emitted by the model; double-tap or retry reusing an old payload |

For each hypothesis the agent must record: *confirmed / rejected / inconclusive*, with the evidence.

---

## 3. Phase 0 — Diagnosis (no behaviour changes)

**Scope:** read, instrument, reproduce, report. No fixes. Only logging/tracing additions and test files may be added.

1. **Map the current implementation.** Document the turn pipeline end to end: where a message enters, how history is built, what is sent to the model (system prompt size, tool list size, history length), how tool calls are parsed and executed, where proposals/drafts are stored, how approval is performed, and which endpoints/services the tools call. Include file paths.
2. **Add per-turn tracing** (kept permanently, see Phase A): correlation ID per turn; timings for each stage (history build, gateway call, time to first token, tool execution, DB, total); token counts; model name; tool calls with arguments and results; errors with stack. Redact secrets and personal data.
3. **Write reproduction tests** for S1–S4 against a test org (not production data):
   - S2: ten phrasings of the same product (plural, abbreviation, Swahili, typo, with unit).
   - S3: propose → approve for each supported action type; also approve after a delay and approve twice.
   - S4: two different sales proposed back-to-back, then approve the second; also propose, cancel, propose again; also two conversations for one org at once.
   - S1: measure end-to-end time and count LLM round trips for a single-item sale.
4. **Deliver `docs/assistant-diagnosis.md`:** architecture map, a root-cause verdict per symptom with evidence (trace excerpts, failing tests), additional defects found, and a recommended fix list ordered by impact. **Wait for review before Phase B onward.**

**Done when:** every symptom has a reproduced, evidenced root cause (or a clearly stated "could not reproduce, here is what was tried"), baseline latency numbers exist, and the ground-rules gates pass.

---

## 4. Target architecture (turn pipeline)

```
user message
 → 1 Preprocess      (normalise text, detect language, attach org/vertical/role)
 → 2 Route           (pick intent family + the small tool subset for this vertical/role)
 → 3 Extract         (LLM → structured JSON: intent, items, quantities, missing fields)
 → 4 Resolve         (code: products/customers/rooms/subscribers → real IDs, with confidence)
 → 5 Validate+Propose(code: permissions, stock, price, dates → persist AssistantAction)
 → 6 Present         (UI card rendered from the stored proposal, shown with its action ID)
 → 7 Approve         (client sends ONLY the action ID)
 → 8 Execute         (transaction, same service layer as the UI, idempotent)
 → 9 Confirm         (message built from the server result)
```

Read-only requests ("how much sugar is left?") skip steps 5–8 and answer directly from resolved data.

---

## 5. Phases

Each phase has a Backend part and a Frontend part. Per ground rule 1.6, the frontend prompt is drafted before backend work starts and issued as soon as the API contract is stable.

### Phase A — Evaluation harness and observability (do first, alongside Phase 0)

**Backend**
- Golden test set: start with at least 100 utterances across verticals, covering English, Swahili, Sheng, typos, abbreviations, multi-item messages, ambiguous items, and the four reported bugs as permanent regression cases. Each case has the expected intent, entities, and outcome.
- A runnable harness (script + CI job) that executes the set against the pipeline with a fake or recorded model where possible and a real model on demand. Output: intent accuracy, entity-resolution accuracy, end-to-end success rate, approval success rate, latency percentiles.
- Persist turn traces (see Phase 0) with retention appropriate to the data. Add an admin-only view or query for failed turns.
- Metrics to track: first-token latency, time to proposal, approve-to-result latency, tool-call failure rate, "asked a clarifying question unnecessarily" rate, stale-proposal incidents (must be zero).

**Frontend:** none, except a hidden debug panel showing the turn ID for support.

**Done when:** the harness runs in CI, a baseline report is committed, and the four bugs exist as failing tests (before fixes) that later phases turn green.

### Phase B — Action registry and proposal/approval state machine (fixes S3 and S4)

**Backend**
1. **Typed action registry.** One definition per action (`reportSale`, `issueStock`, `receiveStock`, `addNote`, `bookRoom`, `registerSubscriber`, …), each with: schema (validation library already used in the repo), allowed verticals (`businessType`), required role/permission, risk tier, a `validate()` step, an `execute()` that calls the existing service layer, and a human-readable summary builder. Tools exposed to the model are generated from this registry, so the assistant can only do what the registry allows.
2. **`AssistantAction` table (additive, nullable-safe, no changes to existing tables):**
   - `id` (UUID), `orgId`, `userId`, `conversationId`, `turnId`, `type`, `payload` (JSON, validated), `status`, `idempotencyKey`, `createdAt`, `expiresAt`, `resultRef`, `errorCode`, `errorMessage`.
   - Status machine: `proposed → approved → executing → executed`, plus `rejected`, `expired`, `superseded`, `failed`. Illegal transitions are rejected in code.
3. **Write tools create proposals only.** A write tool call validates the payload, stores a `proposed` action, and returns its ID and a summary. It does not touch business tables.
4. **Supersede rule.** When the user starts a new proposal of the same type in a conversation, earlier `proposed` actions of that type are marked `superseded`, unless the user's message clearly adds to the existing one ("also add…"). Approving a superseded or expired action returns a clear 409 with a message the UI can show.
5. **Approve endpoint.** `POST /assistant/actions/:id/approve`, taking only the action ID:
   - Scope every query by the authenticated `orgId` and `userId` on the server. Never trust IDs supplied by the model or client for ownership.
   - Re-validate against current state (stock still available, price unchanged, room still free) and return a typed error with a recovery suggestion if it changed.
   - Execute inside a database transaction through the same service functions as the UI endpoints.
   - Idempotent: a repeated approve of an executed action returns the original result and creates nothing new.
   - On failure, set `failed` with a code and message, return the structured error, and let the assistant explain it in plain language with a next step (retry, edit, cancel).
6. **Reject/edit endpoints.** Reject, and edit-before-approve (user changes quantity or price on the card; the server re-validates and updates the same action).
7. **Audit.** Write an audit record for every approved or failed action, following the existing `AdminAuditLog`-style pattern.
8. **History hygiene.** The prompt sent to the model contains the last few turns plus a compact "active state" block (pending proposals by ID, last resolved entities). Raw tool outputs from earlier turns are not replayed, so the model cannot re-emit an old call.

**Frontend**
- Render each approval card from the stored proposal using its action ID. Show status (proposed, superseded, executed, failed).
- Approve/Reject/Edit send only the action ID (and edited fields for Edit). Disable the button after one tap, and handle 409/expired/failed states with a clear message and a one-tap recovery.
- Only the newest active proposal is actionable; older cards become read-only.

**Done when:** the S3 and S4 regression tests pass, double-approve creates exactly one record, a superseded proposal cannot be approved, approval works after reload and from a second device, and no assistant code path writes business data except through `execute()`.

### Phase C — Entity resolution (fixes S2)

**Backend**
1. **`resolve` service**, deterministic and not part of the model's job: normalise (case, punctuation, plurals, units like "2kg", "1 dozen", "3 pkts"), then try in order: exact match, per-organisation alias, trigram similarity (`pg_trgm`), and optionally embeddings (`pgvector`) as a last resort. Return ranked candidates with scores.
2. **Decision rule:** auto-select when the top score is above a threshold *and* clearly ahead of the runner-up; otherwise return the top 3 candidates for the user to choose. Thresholds are configurable and tuned using the Phase A set.
3. **`ProductAlias` (additive table):** when the user confirms a mapping ("unga" → Maize Flour 2kg), store it for that organisation so it resolves instantly next time. Same pattern for customers, rooms, and subscribers.
4. **Catalog access without flooding the prompt.** Tools receive a query and return top-k matches. The full catalog is never put in the model's context. Cache a compact per-organisation catalog index in Redis with invalidation on product change.
5. **Quantities and units** are parsed and validated in code, including unit conversion rules the organisation defines, and ambiguous quantities ("a few") trigger a question.
6. **Multi-item messages** ("sold 2 sugar, 1 bread and 3 milk") resolve each line independently and produce one proposal with several lines, flagging only the uncertain ones.

**Frontend**
- A disambiguation card with tappable candidates ("Did you mean…?") and a "none of these" option that opens search. Inline editing of any line before approval.

**Done when:** at least 95% of the paraphrase set resolves correctly or asks a correct disambiguation (target to confirm after baseline), no wrong auto-selection in the set, and aliases persist per organisation.

### Phase D — Conversation flow and reduced user effort

**Backend**
1. **Structured extraction.** One LLM call returns JSON `{intent, entities[], quantities[], missingFields[], confidence}` against a schema. Invalid JSON gets one automatic repair attempt, then a safe fallback message. Temperature 0.
2. **Slot filling in code.** The server computes which required fields are missing and asks for all of them in one short message, not one question per turn. Sensible defaults (price from catalog, default payment method, today's date) are applied and shown on the card for the user to override.
3. **Templated confirmations and questions.** Clarifying questions and confirmation text come from templates filled with server data, in the user's language. The model is used for understanding, not for wording routine replies (this is also a speed gain).
4. **Fallback for missed intents.** If no action is recognised, the assistant says what it understood and offers the nearest actions as buttons, instead of answering in free prose or silently doing nothing.
5. **Undo.** Reversible actions get an "Undo" for a short window, implemented as a proper compensating action through the service layer, with an audit record.
6. **Convenience features** (after the core is stable): remember frequent items per user, quick-repeat of a recent sale, voice input if the PWA already supports it, and a daily "what's pending" summary.

**Frontend**
- Chat UI with quick-reply chips, the proposal card, undo, and clear states for "understood / needs one detail / done / failed". Show a short typing/progress state immediately on send.

**Done when:** a single-item sale needs at most one user message plus one approval tap in the common case, multi-item messages work, and unnecessary clarifying questions fall below the target set after baseline.

### Phase E — Vertical capability packs

**Backend:** capabilities are registered per `businessType` using the Phase B registry, and the model only ever sees the tools for the user's vertical and role. Use the existing vertical scope docs as the source of truth, and list any action the docs imply that is not yet exposed. Starting matrix (the agent completes it from the repo):

| Vertical | Actions the assistant should support (examples) | Resolves |
|---|---|---|
| Retail / inventory | report sale, issue stock, receive stock, adjust stock, add note, low-stock check | products, customers, units |
| Guest house | book room, check in/out, extend stay, add note, room availability | rooms, guests, dates |
| ISP | register/sign in new subscriber, renew, check status, add note | subscribers, plans |

Rules for every capability: permission check by role, risk tier (read-only runs immediately; mutations need approval; destructive or high-value actions need explicit confirmation text), audit logging, and a regression case in the golden set before it ships.

**Frontend:** vertical-specific card layouts (sale card, booking card, registration card) built from shared components.

**Done when:** each vertical's priority actions work end to end with approval, are invisible to other verticals and unauthorised roles, and have golden-set coverage.

### Phase F — Speed

Do not start until Phase A baselines exist. Measure each change against them.

1. **Stream everything.** Stream model output to the client (SSE) and show the first visible response quickly: an immediate acknowledgement, then the card as soon as the proposal exists.
2. **Fewer LLM round trips.** The common flows are one extraction call followed by code (steps 4–9). No tool-calling loop for simple actions. Keep the loop only for genuinely open-ended requests.
3. **Right-size the model.** Use a small, fast model for routing and extraction, and escalate to a stronger model only when confidence is low or the request is open-ended. Use stable gateway aliases (for example `assistant-fast` and `assistant-smart`) in the LiteLLM config so models can be swapped or given fallbacks without code changes.
4. **Smaller prompts.**
   - Per-vertical, per-role tool subsets (Phase E) instead of every tool every time.
   - Short system prompt, no catalog dump, no raw history replay (Phase B item 8).
   - Put the static content (system prompt, tool definitions) first and dynamic content last so provider prompt caching can work, and enable provider/gateway caching where supported.
5. **Parallelise.** Resolve all items of a multi-item message concurrently, and run independent DB lookups in parallel.
6. **Cache and index.** Redis-cached compact catalog per organisation, trigram/GIN indexes for resolution, and indexes for the proposal lookups. Check query plans.
7. **Connection hygiene.** Keep-alive to the gateway and database, avoid cold starts on the primary path, and keep the API, gateway and model provider in nearby regions. Set sensible timeouts and fail over to the fallback model instead of waiting.
8. **Cap output.** Set `max_tokens` per call type, and use code-generated text where possible.
9. **Perceived speed in the PWA.** Optimistic UI on approve (with rollback on failure), skeleton states, and no blocking spinners.

Tentative targets, to be confirmed against the baseline: first visible response in about 1 s; single-sale proposal card in about 3 s at p50 and 6 s at p95; approve-to-result in about 1.5 s at p95.

**Done when:** targets are met or the gap is explained with measurements, and the harness shows no accuracy regression from the speed changes.

---

## 6. Safety and correctness rules

- Treat all tool outputs, product names, notes, and user-supplied text as data, never as instructions to the model.
- Every query is scoped by the authenticated organisation on the server. Cross-organisation access must be impossible even if the model supplies another ID.
- No mutation without a stored, validated, user-approved proposal. High-value or destructive actions require stronger confirmation.
- The assistant must say plainly when it could not do something, and never describe an unexecuted action as done.
- Rate-limit assistant endpoints per user and organisation, and cap proposals per minute.
- Rollout behind a feature flag per organisation, starting with internal and test organisations, with a one-step switch back to the old assistant until Phase B and C metrics are green.

---

## 7. Progress tracker

| Phase | Owner | Status | PR / date | Notes |
|---|---|---|---|---|
| 0 Diagnosis | Agent | Done | 2026-11-24 | Confirmed root causes S1–S4 in `docs/assistant-diagnosis.md` |
| A Eval harness + observability | Agent | In progress | 2026-11-24 | `symptoms.spec.ts` + `entity-resolution.service.spec.ts` S1–S4 regression suite passing; 100-utterance corpus & persistent turn traces pending |
| B Action registry + proposal state machine | Agent | Partial | 2026-11-24 | Atomic `approve`+`execute` (S3) and `SUPERSEDED` conversation-scoped proposal state (S4) shipped; history-hygiene active-state block & `AssistantAction` rename pending |
| C Entity resolution | Agent | Partial | 2026-11-24 | `EntityResolutionService` (Swahili/Sheng synonyms, unit stripping, Levenshtein fuzzy match, tie detection) wired into `record_sale`/`record_purchase`/`record_wastage` & `search_inventory`; org-learned `ProductAlias` table & multi-item lines pending |
| D Conversation flow |  | Not started |  |  |
| E Vertical packs |  | Not started |  | Existing vertical tool providers active; full action-matrix audit pending |
| F Speed |  | Not started |  | S1 single-round-trip `record_sale` (`itemName` direct) shipped; SSE streaming & single-call extraction pending |

---

## 8. Open decisions (answer before the relevant phase)

1. Which actions per vertical are in scope for the first release? (Phase E matrix, to be confirmed from the vertical scope docs.)
2. Which actions may run without approval (for example notes or read-only queries), and which always need it?
3. Which languages must be supported first (English, Swahili, Sheng)?
4. Is the undo window wanted, and for which actions?
5. Are voice input and daily summaries in scope for this upgrade or a later one?
6. Latency targets: confirm or adjust after the baseline.
