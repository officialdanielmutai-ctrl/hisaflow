# HisaFlow — Assistant Redesign: Vertical Enablement (Production Fix)

**Directive:** `hisaflow-quality-and-assistant-overhaul.md` (Duty 2, Section 3.3/3.6) — production follow-up.
**Status:** Implemented, cross-vertical. All local gates green, including the real-Postgres e2e (16/16).
**Date:** 2026-10-14.
**Depends on:** `hisaflow-assistant-phase-b.md`, `-e.md`, `hisaflow-assistant-resilience-memory-notes.md`.
**Defects closed:** Q-016 (flags), Q-017 (vertical gating) — `hisaflow-overhaul-defect-log.md`.

---

## 1. The production report

After the resilience/note/memory work, production still behaved as if the
assistant could do nothing — reported on the **guest house**:

- “create a stock” → the assistant said it could not;
- “write a note” → it wrote plain text instead of proposing a note;
- “fetch inventory” → it could not.

The legacy `/ai` ingestion could act, but the assistant could not. The fixes had
to apply to **every** vertical, not the guest house alone.

## 2. Root causes (both confirmed in code)

1. **No tools were offered (Q-016).** `FeatureFlagService.isEnabled` returned
   `false` whenever no `feature_flags` row matched. The assistant was built
   behind flags that default **off**, and `apps/backend/package.json` boots with
   `prisma db push --accept-data-loss` (schema sync, **not** `prisma migrate
   deploy`), so the `assistant.read` / `assistant.write` / `assistant.communicate`
   rows were never seeded in production. `AssistantPolicyService.filterTools`
   then removed every tool, leaving the model with nothing to call — so it
   answered in prose and never proposed anything.
2. **Inventory write tools were vertical-gated (Q-017).** `create_inventory_item`,
   `update_inventory_item`, `record_purchase` and `record_wastage` carried narrow
   `verticals` lists (retail/chemist/restaurant/wholesaler), so a guest house,
   school or ISP could not create or restock stock through the assistant even
   once flags were on.

## 3. What changed

| Change | File | Notes |
|---|---|---|
| Default-on capabilities | `policy/feature-flag.service.ts` | New `DEFAULT_ENABLED_FLAGS` = `assistant.read`, `assistant.write`, `assistant.communicate`. When **no** row exists these are enabled; any explicit row (ORGANIZATION > BUSINESS_TYPE > GLOBAL) still wins and can disable a capability; unknown keys and `assistant.shadow` stay denied. This is a code default because production uses `db push`, so a data migration would not run. |
| Cross-vertical inventory | `tools/assistant-tools.service.ts` | `create_inventory_item`, `update_inventory_item`, shared `record_purchase` and shared `record_wastage` are now available to **every** business type (no `verticals` filter). Domain-specific sale paths stay gated: `record_sale`, `record_wholesale_sale`, `add_consumption`, `issue_equipment`, `record_supply_issue`. |
| Stock prompt example | `agent/assistant-agent.service.ts` | Adds a concrete “add a new item, 20 bags of unga” → `create_inventory_item` / `record_purchase` example so weaker models pick the right tool. |

The kill switch is preserved: inserting (or flipping) an explicit
`feature_flags` row with `enabled = false` still disables the capability for a
global, business-type or organization scope. The single governed write path is
unchanged — the assistant still only proposes; the user approves and the
executor commits.

## 4. Tests + gates

- `policy/feature-flag.service.spec.ts` — default-on for read/write/communicate; unknown and `assistant.shadow` denied when absent; an explicit `enabled=false` row still turns a capability off.
- `assistant.module.spec.ts` — **“offers the shared inventory tools to every vertical”**: guest house, ISP and school each see `list_inventory`, `create_note`, `create_inventory_item`, `update_inventory_item`, `record_purchase` and `record_wastage`.
- `test/assistant-lifecycle.e2e-spec.ts` (real Postgres) — **“reads and proposes shared inventory tools with no feature-flag rows (default on)”**: with the flag table empty, a guest-house org can read inventory and create an `create_inventory_item` proposal.

Local gates:

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | Pass |
| E2E `tsc --noEmit` | Pass |
| Backend ESLint (module + e2e) | 0 errors |
| Backend tests | **103 suites / 814 tests** |
| Backend `nest build` | Pass |
| Backend e2e (real Postgres) | **16/16 pass** |
| Frontend / admin | unchanged (previously green) |

## 5. Remaining / deferred

- The live-model shadow/eval run still needs the configured `hisaflow-assistant`
  gateway in staging.
- `record_sale` deliberately remains vertical-gated (wholesale, guest house, ISP
  and school have domain-specific sale paths). If the owner wants a generic sale
  tool in those verticals, it should be a separate, reviewed decision.
- An admin UI for the feature flags is still a follow-up; today the rows are
  managed directly.
