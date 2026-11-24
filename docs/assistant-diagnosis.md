# HisaFlow Assistant — Architecture Map, Root-Cause Diagnosis (S1–S4) & Fix Summary

> Companion to `hisaflow-assistant-upgrade.md`. Covers the current end-to-end turn pipeline, verified root causes for symptoms S1–S4, implemented fixes, and remaining phased scope.

---

## 1. Current Turn Pipeline Architecture Map

1. **Ingress (`apps/backend/src/modules/assistant/assistant.controller.ts`):**
   - `POST /assistant/chat` delegates to `AssistantService.chat()`.
   - `POST /assistant/proposals/:id/approve` delegates to `AssistantService.approve()`.
   - `POST /assistant/proposals/:id/reject`, `POST /assistant/proposals/:id/revise`, and `POST /assistant/proposals/:id/execute` remain available for lifecycle management and failure recovery.
2. **Thread Memory (`apps/backend/src/modules/assistant/memory/assistant-memory.service.ts`):**
   - Resolves or starts a conversation scoped by `(organizationId, userId, conversationId)`, retrieves message history, appends user/assistant turns, and prunes old threads.
3. **Context & Tool Policy (`context/assistant-context.service.ts`, `registry/tool-registry.service.ts`, `policy/policy.service.ts`):**
   - Builds `ToolContext` (`organizationId`, `userId`, `role`, `businessType`, `tier`, `isImpersonated`, `conversationId`).
   - Vertical packs are provided via `ASSISTANT_TOOL_PROVIDERS` in `assistant.module.ts` (`AssistantToolsService`, `IspAssistantToolsService`, `GuestHouseAssistantToolsService`, `SchoolAssistantToolsService`, `WholesaleAssistantToolsService`, `RestaurantAssistantToolsService`, `ChemistAssistantToolsService`) and filtered by `AssistantPolicyService`.
4. **Agent Loop & LLM Gateway (`agent/assistant-agent.service.ts`, `provider/assistant-provider.service.ts`):**
   - Sends system prompt, recent history, current user message, and filtered tool schemas to LiteLLM (`MAX_TOOL_CALLS_PER_TURN = 8`).
   - Read/utility tools run via `tool.execute(args, ctx)`.
   - Write/communicate tools call `tool.buildProposal(args, ctx)` and persist a proposal via `ProposalService.create(...)`.
5. **Deterministic Entity Resolution (`resolution/entity-resolution.service.ts`):**
   - `EntityResolutionService.resolveInventoryItem(organizationId, rawQuery, limit)` normalises queries, strips units (`UNIT_REGEX`), expands Kenyan English/Swahili/Sheng synonyms (`SYNONYMS`), scores exact/substring/token-overlap/Levenshtein matches across active org inventory items, and returns `{ bestMatch, candidates, confidence }`, leaving `bestMatch` null on close ties (`top.score - runnerUp.score < 0.10` or `runnerUp.score >= 0.85`).
6. **Proposal Store & Governed Executor (`proposal/proposal.service.ts`, `executor/executor.service.ts`, `executor/assistant-audit.service.ts`):**
   - `ProposalService` stores `argsJson`, deterministic `argsHash`, `idempotencyKey`, `conversationId`, `version`, and `expiresAt` (`PROPOSAL_TTL_MS = 30m`) in `assistant_proposals`.
   - `AssistantExecutorService.execute()` verifies tenant scope, approval state, `argsHash` immutability, and policy, executes `tool.commit(args, ctx)` against domain services (`TransactionsService`, `InventoryService`, `NotesService`, `BusinessTransactionsService`, etc.), records `AssistantAuditLog`, and marks the proposal `EXECUTED` (or `FAILED` with `errorMessage`).

---

## 2. Root-Cause Verdicts & Implemented Fixes (S1–S4)

| # | Symptom | Verdict | Evidence & Root Cause | Fix Implemented |
|---|---|---|---|---|
| **S1** | Reporting a sale takes long or misses the sale | **Confirmed** | System prompt and tool flow forced extra LLM round trips (`search_inventory` before `record_sale`), increasing turn latency and failure surface. | Updated `AssistantAgentService.systemPrompt()` and `record_sale` tool schema/handler in `assistant-tools.service.ts` so the model can call `record_sale` directly with `itemName` and `quantity`; `buildProposal` resolves the item internally in one turn. |
| **S2** | Product phrased differently isn't recognised | **Confirmed** | Prior lookups relied solely on case-insensitive `contains` DB substring queries with no unit stripping, Swahili/Sheng synonym expansion, or typo tolerance. | Added `EntityResolutionService` (`resolution/entity-resolution.service.ts`) with unit stripping, Swahili/Sheng synonym table, token overlap, and Levenshtein fuzzy matching; wired into `transactionTool()` (`record_sale`, `record_purchase`, `record_wastage`) and `search_inventory` fallback. |
| **S3** | Approval step errors after user taps Apply | **Confirmed** | Two-step Approve → Execute UI split caused extra state transitions (`PROPOSED -> APPROVED -> EXECUTED`) and `confirmAll` / `approve` confusion. | `AssistantService.approve()` now atomically transitions `PROPOSED -> APPROVED` and invokes `AssistantExecutorService.execute()` immediately in the same request, returning `{ ...PublicProposal, execution }`. Updated `AssistantPanel.tsx` (`runProposalAction`, `handleSaveNote`, `confirmAll`) and `ProposalCard.tsx` while keeping idempotent `execute()` as retry fallback. |
| **S4** | New sale request submits a previous sale | **Confirmed** | Earlier unapproved `PROPOSED` proposals remained actionable (`PROPOSED`) in `assistant_proposals` and client state when a newer proposal for the same action was drafted in the same conversation. | Added `SUPERSEDED` to `AssistantProposalStatus` (`schema.prisma` + migration `20261124000000_add_superseded_proposal_status`), added `conversationId` to `ToolContext` and `ProposalService.create()`, superseded prior `PROPOSED` proposals for the same tool/conversation on `create()`, handled `revise()` cleanly in `AssistantService.revise()`, and updated `AssistantPanel.tsx` / `ProposalCard.tsx` (`SUPERSEDED` badge + `"Replaced by a newer request."`). |

---

## 3. Remaining Phased Scope (from `hisaflow-assistant-upgrade.md`)

- **Phase A (Observability & 100-utterance CI harness):** Turn-level tracing persisted to DB, latency percentile reporting, and 100+ golden utterances beyond the initial `symptoms.spec.ts` S1–S4 regression suite.
- **Phase B / C extensions:** Dedicated `ProductAlias` org-learned table, Redis catalog index cache, inline disambiguation candidate cards, and multi-item proposal lines.
- **Phase D / E / F:** Single-call JSON intent extraction outside the tool loop, templated replies/undo, explicit per-vertical capability parity audit across Guest House / ISP / School / Restaurant / Chemist / Wholesale, and SSE streaming.
