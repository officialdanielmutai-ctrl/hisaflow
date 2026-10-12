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

Local gates: backend `tsc` clean, **88 Jest suites / 629 tests pass** (39 assistant), `nest build` clean, ESLint clean for the module.

## 4. Enabling (flags default off)

Nothing is available until an org has the flags. Insert, e.g.:

```sql
INSERT INTO feature_flags (id, key, scope, scope_value, enabled, rollout_pct, updated_at)
VALUES
  (gen_random_uuid()::text, 'assistant.read',  'GLOBAL', '', true, 100, now()),
  (gen_random_uuid()::text, 'assistant.write', 'GLOBAL', '', true, 100, now());
```

Scope `BUSINESS_TYPE` with `scope_value = 'DUKA'` to gate the first vertical only. An admin UI for flags is a follow-up (D2-E).

## 5. Staging e2e (pending)

The Phase B done criteria require a staging end-to-end run. There is no seeded Postgres locally (Phase 0 discovery), so this is deferred exactly like the Duty 1 screenshot affirmation: run `POST /assistant/proposals` → `approve` → `execute` against a seeded org once the environment is available.

## 6. Phase C — DUKA parity port (started)

Covered now: `get_low_stock`, `search_inventory`, `record_sale`, `record_purchase`, `record_wastage`.
Remaining P0 for DUKA parity: `create_inventory_item`, `update_inventory_item` (these must go through `InventoryService`, whose create path spans `Product` + `InventoryItem` — handle carefully), then shadow-mode comparison against the existing `ai-ingestion` path behind a per-org flag. The registry, proposal store, policy gate, executor, audit and flags are all in place for that work.
