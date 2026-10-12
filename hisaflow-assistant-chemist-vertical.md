# HisaFlow — Assistant Redesign: Chemist Vertical Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E (“remaining verticals”).
**Status:** Chemist P0 (+P1) tool set ported and tested. This completes vertical parity for Phase E.
**Date:** 2026-10-12.
**Depends on:** Phase B/D/E foundation (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`, `hisaflow-assistant-phase-e.md`).
**Predecessor verticals:** DUKA, ISP, guest house, school, wholesaler, restaurant. Backlog source: `hisaflow-assistant-phase-a.md` §4.3 (CHEMIST).

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/` unless stated.

| Piece | File | Notes |
|---|---|---|
| Chemist tool set | `tools/chemist-assistant-tools.service.ts` | 4 tools, all `verticals: ['CHEMIST']`; writes only build proposals |
| Shared stock/item tools | `tools/assistant-tools.service.ts` | `record_sale` / `record_purchase` / `record_wastage` and `create_inventory_item` / `update_inventory_item` widened to `CHEMIST`; `create_inventory_item` gained optional `expiryDate`/`batchNumber` carried on the variant |
| Module wiring | `assistant.module.ts` | Imports `StockBatchesModule` and registers the seventh provider |

### 1.1 Tools

**Reads (auto-run, side-effect free):**

| Tool | Maps to | Purpose |
|---|---|---|
| `list_expiring_batches` | `GET /stock-batches/expiring` | expired/near-expiry batches, earliest first, with item names |
| `get_drug_info` | `GET /inventory` | look up a medicine by name (price, stock, batch/expiry) |

**Writes (proposal-only; commit calls the same domain service the manual UI calls):**

| Tool | Commits through | Risk | Roles |
|---|---|---|---|
| `receive_stock_batch` | `StockBatchesService.create` | medium | OWNER, MANAGER, STAFF |
| `record_expiry_writeoff` | `TransactionsService.create` (WASTAGE) | medium | OWNER, MANAGER, STAFF |
| `record_sale` / `record_purchase` / `record_wastage` | `TransactionsService.create` (shared) | low–medium | OWNER, MANAGER, STAFF |
| `create_inventory_item` / `update_inventory_item` | `InventoryService.create` / `updateVariant` (shared) | low | OWNER/MANAGER/STAFF, OWNER/MANAGER |

`dispense_prescription(items[])` from the backlog is **not** a new tool: it is the agent issuing several `record_sale` proposals in one turn (the Phase D multi-action “Review and confirm” flow). No new commit path was added.

## 2. The single governed write path is unchanged

```
assistant chat → buildProposal (scoped lookups, no side effect)
              → Proposal(PROPOSED) → approve → execute
              → executor: tenant scope · APPROVED · argsHash immutability
                          · policy re-check · tool.commit (manual service)
```

`AssistantExecutorService` remains the only component that commits assistant actions. Chemist tools add no second path — every `commit` calls `StockBatchesService` or `TransactionsService`, the same services used by the batch-receiving sheet and the transactions screens.

**Batch semantics.** `TransactionsService.create` already deducts chemist stock FIFO across batches on SALE/WASTAGE, and `StockBatchesService.create` adds a batch and increments the item quantity. The assistant reuses both:
- `receive_stock_batch` → `StockBatchesService.create` (batch row + item quantity up).
- `record_expiry_writeoff` → `TransactionsService.create` WASTAGE for the batch's item and quantity (item quantity + FIFO batch quantity down).
- `record_sale` / `record_wastage` → `TransactionsService.create` (FIFO batch deduction).

Diffs render one before/after row keyed by item name; the expiry write-off summary names the batch and expiry date.

## 3. Registry

The registry now aggregates all seven providers behind `ASSISTANT_TOOL_PROVIDERS` (foundation/DUKA, ISP, guest house, school, wholesaler, restaurant, chemist). `assistant.module.spec.ts` compiles the real module graph and asserts the token yields seven providers, that a chemist sees its own tools plus the shared stock/item tools, and that other verticals do not see chemist tools.

## 4. Honesty / behaviour rules

- **Batch-first for medicines.** `receive_stock_batch` records a batch and expiry; `record_expiry_writeoff` writes off a specific batch, refusing an empty/unknown one. `create_inventory_item` carries optional expiry/batch on the variant.
- **Read before write.** Writes require server-resolved item/batch IDs; ambiguity is a question, not a guess.
- **`get_drug_info` is the org catalogue, not a drug database.** The tool description says so; it searches the organization’s own inventory and never claims pharmacological knowledge.
- **Model never supplies identity.** Org/user come from `AssistantContextService`; every lookup and commit is scoped by `ctx.organizationId`.
- **Suggestion chips are tool-derived**, so a chemist never sees other verticals’ chips and vice versa.

## 5. Tests + gates

- `tools/chemist-assistant-tools.service.spec.ts` — 10 tests: vertical gating for all 4 tools, org scoping, expiry-window cap, expired flagging, drug lookup, batch receive projection/commit and validation, and expiry write-off (decrease, empty-batch refusal, unknown-batch refusal).
- `assistant-tools.service.spec.ts` — adds the item-create expiry/batch variant path test.
- `assistant.module.spec.ts` — seven-provider aggregation + chemist/shared-tool isolation.
- `apps/frontend/lib/assistant.spec.ts` — chemist labels + tool-derived chips (2 new tests).
- Gates: backend `tsc` + **101 suites / 788 Jest tests** + `nest build` + module ESLint (0 errors); frontend `tsc` + `next lint` (0 errors) + **152 vitest** + `next build`.

## 6. Remaining / deferred

- **P2** `send_refill_reminder` (consent-gated) — depends on the per-customer consent store.
- **Live shadow run** on the chemist characterization set with `assistant.shadow` (default off) — needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Live e2e + 7-viewport screenshots and streaming replies (carried over from Phases B–D).
- Phase F: injection/abuse suite, cost/rate controls, live eval baselines, retirement of the per-vertical capability prompts.

## 7. Recorded limitations

1. **Expiry write-off follows FIFO, not the exact batch.** `record_expiry_writeoff` commits a WASTAGE transaction for the batch’s item and quantity; `TransactionsService` then deducts batches earliest-expiry-first. For an expired batch (the normal case) that is the same batch, but writing off a non-first batch can deduct a different one even though the item total is correct. A per-batch deduction service is a domain change and is not introduced here.
2. **`StockBatchesService.retire` is not used.** `retire` zeroes a batch row but does not decrement the item quantity, so on its own it would leave stock inflated and un-ledgered. The assistant writes off through the transactions ledger instead, so item and batch stay consistent.
3. **`update_inventory_item` cannot change expiry/batch.** `UpdateVariantDto` does not carry those fields. Expiry is managed through batches (`receive_stock_batch`) and item creation (`create_inventory_item`), matching where the platform actually reads expiry from.
4. **`dispense_prescription` is multi-intent, not one tool.** Each medicine is a separate `record_sale` proposal; the user reviews them together. This is deliberate — a single tool committing several ledger writes would be a second write path.
5. **Batch numbers are not unique.** `StockBatch` has no unique constraint on `batchNumber`, so `receive_stock_batch` accepts duplicates (matching the manual sheet). The batch ID remains the identity for write-off.
