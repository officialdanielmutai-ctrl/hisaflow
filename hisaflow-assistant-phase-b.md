# HisaFlow — Assistant Redesign: Phase B Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase B / Prompt D2-B.
**Status:** Implemented (backend). Staging end-to-end run pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** signed-off Phase A (`hisaflow-assistant-phase-a.md`). Owner decision: first vertical = **DUKA**.

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/`.

| Component | File | Notes |
|---|---|---|
| Typed tool contract | `tool.types.ts` | `read`/`write`/`communicate`/`utility`, risk level, JSON-schema params, optional role/vertical/tier gates, `execute` for reads, `buildProposal` + `commit` for writes |
| Tool registry | `registry/tool-registry.service.ts` | The only source of capabilities; filters per org/role/vertical; model-facing schemas never contain identity |
| Tool set | `tools/assistant-tools.service.ts` | `get_low_stock`, `search_inventory` (reads); `create_note`, `record_sale`, `record_purchase`, `record_wastage` (writes) |
| Proposal store | `proposal/proposal.service.ts` | Durable, `argsHash` (SHA-256 over canonical JSON), idempotency key, 30-min expiry, approve/reject, tenant-scoped reads |
| Policy gate | `policy/policy.service.ts` | Enforced at the execution layer: impersonation, vertical, role, tier, feature flag. Default deny. |
| Feature flags | `policy/feature-flag.service.ts` | Table-backed, scoped GLOBAL → BUSINESS_TYPE → ORGANIZATION, deterministic rollout |
| Executor | `executor/executor.service.ts` | The single governed write path: tenant scope, approval, hash immutability, policy re-check, idempotency, audit |
| Audit | `executor/assistant-audit.service.ts` | Privacy-safe rows for start / executed / failed |
| Context | `context/assistant-context.service.ts` | Server injects `organizationId`/`userId`/role/tier — never the model |
| API | `assistant.controller.ts` | `GET /assistant/tools`, `POST /assistant/tools/:name/run`, `POST/GET /assistant/proposals`, `POST /assistant/proposals/:id/{approve,reject,execute}` |

Additive schema (`prisma/schema.prisma` + migration `20261012000000_add_assistant_foundation`):
`AssistantProposal`, `AssistantAuditLog`, `FeatureFlag`, enums `AssistantProposalStatus`, `FeatureFlagScope`.
No `Organization` relation is added; tenant scoping is enforced in code.

## 2. The single governed write path

```
POST /assistant/proposals { tool, args }   → policy → tool.buildProposal (no side effect) → Proposal(PROPOSED)
POST /assistant/proposals/:id/approve       → Proposal(APPROVED)
POST /assistant/proposals/:id/execute       → executor:
     tenant scope → status must be APPROVED → hash(args) must equal argsHash
     → policy re-check → tool.commit (same service as the manual UI) → Proposal(EXECUTED) + audit
```

There is exactly **one** code path that commits assistant writes (`AssistantExecutorService.execute`). A code review that finds a second is a Sev1.

## 3. Phase B done-criteria — evidence

| Criterion | Evidence |
|---|---|
| Trivial read + write work end to end | `assistant-tools.service.spec.ts`: `get_low_stock` returns scoped low items; `create_note` builds a proposal then commits through `NotesService` |
| No write executes without an approved proposal | `executor.service.spec.ts` "refuses to execute a proposal that is not approved" (commit never called) |
| Approved-args hash check | `executor.service.spec.ts` "refuses to execute when the approved arguments were changed"; `proposal.service.spec.ts` canonical-JSON hash tests |
| Idempotency | `executor.service.spec.ts` "returns the stored result for an already-executed proposal" (commit never called again) |
| Cross-tenant attempt rejected | `executor.service.spec.ts` "rejects a proposal outside the calling organization"; `proposal.service.spec.ts` scoped lookup; `assistant-tools.service.spec.ts` scoped item query |
| Unknown tools denied | `tool-registry.service.spec.ts` (`assertKnown` throws); policy default-denies disabled flags |
| DUKA transaction tools | `assistant-tools.service.spec.ts`: `record_sale` decrease, `record_purchase` increase, `record_wastage` with reason |
| Audit logging | executor writes `execute_start` / `executed` / `execute_failed` (asserted) |
| Real-Postgres e2e of the whole path | `test/assistant-lifecycle.e2e-spec.ts` — 11 cases (vertical tool filtering, read auto-run, propose→approve→execute, pre-approval refusal, idempotency, args-hash immutability, tenant isolation, flag denial, revise/versioning, reject, unsupported-intent capture, consent-checked comms, ISP `create_subscriber` commit) |

Local gates: backend `tsc` clean, **102 Jest suites / 792 tests pass** (200 of them assistant/config), `nest build` clean, ESLint clean for the module; the four e2e suites (32 tests) pass against a real Postgres.

## 4. Enabling (flags default off)

Nothing is available until an org has the flags. Insert, e.g.:

```sql
INSERT INTO feature_flags (id, key, scope, scope_value, enabled, rollout_pct, updated_at)
VALUES
  (gen_random_uuid()::text, 'assistant.read',        'GLOBAL', '', true, 100, now()),
  (gen_random_uuid()::text, 'assistant.write',       'GLOBAL', '', true, 100, now()),
  (gen_random_uuid()::text, 'assistant.communicate', 'GLOBAL', '', true, 100, now()),
  (gen_random_uuid()::text, 'assistant.shadow',      'GLOBAL', '', false, 100, now());
```

Scope `BUSINESS_TYPE` with `scope_value = 'DUKA'` to gate the first vertical only. `assistant.shadow` defaults off. An admin UI for flags is a follow-up (D2-E).

## 5. Real-Postgres e2e (closed 2026-10-13)

The Phase B done criteria require an end-to-end run of the governed path. `apps/backend/test/assistant-lifecycle.e2e-spec.ts` now runs the real Nest app against a real Postgres (the CI `backend:test:e2e` job) and proves, with a database: the org gets only its vertical's tools; a read tool auto-runs; a write does not mutate before approval and is idempotent on re-execute; approved args are immutable (hash check); proposals are tenant-isolated; a write is denied when its flag is off; `revise` creates a new version and rejects the superseded one; a rejected proposal can never execute; unsupported intents are recorded and listed; communicate tools send only after approval and honour opt-out consent; and a vertical tool (`create_subscriber`) commits end to end. No model provider is called — this exercises the deterministic propose/approve/execute contract, not the LLM loop. The live shadow run and live-model evals remain the only deferred assistant verification (they need the configured gateway).

## 6. Phase C — DUKA parity port

The DUKA P0 parity list is now fully covered by tools:

| Priority | Tool | Maps to | Status |
|---|---|---|---|
| P0 | `get_low_stock`, `search_inventory` | scoped inventory reads | done |
| P0 | `record_sale`, `record_purchase`, `record_wastage` | `TransactionsService.create` | done |
| P0 | `create_inventory_item` | `InventoryService.create` (Product + InventoryItem variant) | done |
| P0 | `update_inventory_item` | `InventoryService.updateVariant` (name/unit/prices/threshold) | done |

Remaining before Phase C is complete:

- **Live shadow run** on the characterization set in staging (flag `assistant.shadow`, default off). The comparator and the flag-gated service are implemented; the live run needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Flags stay **default off**.

### Shadow mode (implemented)

- `shadow/shadow-comparison.ts` — pure mapper + comparator: maps legacy `ParsedAction`s to tool calls (`record_sale`, `record_purchase`, `record_wastage`, `create_inventory_item`, `update_inventory_item`, `create_note`), then scores exact / partial (same tool + subject, different args) / missing / extra, order-independently.
- `shadow/shadow.service.ts` — runs both pipelines (legacy `AiIngestionService.parseInventoryText` + the new `AssistantAgentService`), compares only write tools, and writes an `assistant_audit_logs` `shadow_compare` row. Guarded by the `assistant.shadow` flag.
- Endpoint: `POST /assistant/shadow`.

### Agent loop (implemented)

- `provider/assistant-provider.service.ts` — the only LiteLLM call site, using the ordered `hisaflow-assistant` model group, `tools`, `tool_choice: auto`, temperature 0.1.
- `agent/assistant-agent.service.ts` — offers only policy-allowed tools; auto-runs reads; writes create proposals and never commit; caps at 6 tool calls/turn; feeds tool errors back to the model.
- Endpoint: `POST /assistant/chat`.

### Vertical scope (confirmed 2026-10-12)

Only the stock/inventory tools are vertical-gated, and only to the retail group: `verticals: ['DUKA', 'MINI_MART']`. `get_low_stock`, `search_inventory` and `create_note` are the intentionally vertical-agnostic foundation tools from Phase A §4.3; exposure is still controlled by the (default-off) feature flags. No ISP, school, guest-house, chemist, restaurant or wholesaler tool exists in production code.
