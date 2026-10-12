# HisaFlow — Assistant Redesign: Restaurant Vertical Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E (“remaining verticals”).
**Status:** Restaurant P0 (+P1 recipe/price) tool set ported and tested. Live shadow run + screenshots pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** Phase B/D/E foundation (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`, `hisaflow-assistant-phase-e.md`).
**Predecessor verticals:** DUKA, ISP, guest house, school, wholesaler. Backlog source: `hisaflow-assistant-phase-a.md` §4.3 (RESTAURANT).

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/` unless stated.

| Piece | File | Notes |
|---|---|---|
| Restaurant tool set | `tools/restaurant-assistant-tools.service.ts` | 8 tools, all `verticals: ['RESTAURANT']`; writes only build proposals |
| Shared stock movements | `tools/assistant-tools.service.ts` | `record_sale` / `record_purchase` / `record_wastage` widened to `RESTAURANT`; `record_sale` now **refuses composite menu items** and points to `record_recipe_consumption` |
| Module wiring | `assistant.module.ts` | Imports `TableOrdersModule` and registers the sixth provider |

### 1.1 Tools

**Reads (auto-run, side-effect free):**

| Tool | Maps to | Purpose |
|---|---|---|
| `get_open_tables` | `GET /table-orders` | open orders, items and totals |
| `list_menu_items` | `GET /inventory` | item IDs, prices and composite flags |
| `get_menu_item_recipe` | composite recipe | ingredients and amounts of a dish |

**Writes (proposal-only; commit calls the same domain service the manual UI calls):**

| Tool | Commits through | Risk | Roles |
|---|---|---|---|
| `create_table_order` | `TableOrdersService.create` | medium | OWNER, MANAGER, STAFF |
| `add_order_item` | `TableOrdersService.addItem` | medium | OWNER, MANAGER, STAFF |
| `close_table_order` | `TableOrdersService.closeOrder` | medium | OWNER, MANAGER, STAFF |
| `record_recipe_consumption` | `TransactionsService.create` (SALE) | medium | OWNER, MANAGER, STAFF |
| `update_menu_price` | `InventoryService.updateVariant` | medium | OWNER, MANAGER |
| `record_sale` / `record_purchase` / `record_wastage` | `TransactionsService.create` (shared) | low–medium | OWNER, MANAGER, STAFF |

## 2. The single governed write path is unchanged

```
assistant chat → buildProposal (scoped lookups, no side effect)
              → Proposal(PROPOSED) → approve → execute
              → executor: tenant scope · APPROVED · argsHash immutability
                          · policy re-check · tool.commit (manual service)
```

`AssistantExecutorService` remains the only component that commits assistant actions. Restaurant tools add no second path — every `commit` calls `TableOrdersService`, `TransactionsService` or `InventoryService`, the same services used by the table-orders, transactions and inventory screens.

**Deduction planning.** `close_table_order` and `record_recipe_consumption` compute the stock the operation will move before proposing it: composite dishes deduct each recipe ingredient (`quantityUsed × quantity`), plain items deduct their own stock. If any ingredient/item is short, the proposal is refused at build time with the exact shortfall. The diff renders one before/after row per ingredient/item.

## 3. Shared stock tools and the composite guard

The `record_sale` tool is shared with retail but now refuses an item flagged `isComposite`:

> “This is a composite menu item; sell it with `record_recipe_consumption` (or through a table order) so ingredient stock is deducted.”

A composite dish holds no stock of its own, so a plain sale would show a misleading `0 → -qty` diff even though `TransactionsService` deducts ingredients. The guard keeps the proposal honest and routes the request to the recipe tool. There is a regression test for this in `assistant-tools.service.spec.ts`.

The registry now aggregates six providers behind `ASSISTANT_TOOL_PROVIDERS`. `assistant.module.spec.ts` compiles the real module graph and asserts the token yields six providers, that a restaurant sees its own tools plus the shared stock tools, and that other verticals do not see restaurant tools.

## 4. Honesty / behaviour rules

- **Read before write.** Table orders require server-resolved order/item IDs; a missing `unitPrice` falls back to the item’s `sellingPrice` (or 0), never a guessed number.
- **Stock is checked at build time** for a table close and a recipe sale; the exact shortfall is surfaced.
- **Composite vs plain is explicit.** `record_recipe_consumption` refuses non-composite items and says to use `record_sale`; `record_sale` refuses composite items and says to use the recipe tool.
- **Model never supplies identity.** Org/user come from `AssistantContextService`; every lookup and commit is scoped by `ctx.organizationId`.
- **Suggestion chips are tool-derived**, so a restaurant never sees other verticals’ chips and vice versa.

## 5. Tests + gates

- `tools/restaurant-assistant-tools.service.spec.ts` — 14 tests: vertical gating for all 8 tools, owner/manager gating for menu pricing, open-table listing and totals, menu prices, recipe reads, table-order creation with price fallback, add-item state guard, close-order ingredient/plain deductions and shortage refusal, recipe consumption (composite only), and menu-price validation.
- `assistant-tools.service.spec.ts` — adds the composite-sale guard test.
- `assistant.module.spec.ts` — six-provider aggregation + restaurant/shared-tool isolation.
- `apps/frontend/lib/assistant.spec.ts` — restaurant labels + tool-derived chips (2 new tests).
- Gates: backend `tsc` + **100 suites / 776 Jest tests** + `nest build` + module ESLint (0 errors); frontend `tsc` + `next lint` (0 errors) + **150 vitest** + `next build`.

## 6. Remaining / deferred

- **P2** `send_daily_special` (consent-gated) — depends on the per-customer consent store.
- `void_table_order` / `remove_order_item` are **not** ported (the approved backlog lists only create/add/close). They could be added later with the same proposal discipline.
- **Live shadow run** on the restaurant characterization set with `assistant.shadow` (default off) — needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Live e2e + 7-viewport screenshots and streaming replies (carried over from Phases B–D).
- Remaining vertical: chemist.

## 7. Recorded limitations

1. **`closeOrder` decrements without a stock check.** `TableOrdersService.closeOrder` reduces ingredient/item quantities directly and can take them negative if the manual UI closes an under-stocked order. The assistant’s `close_table_order` checks first and refuses, but the underlying service remains unguarded — a Duty 3 follow-up, not a Phase E change.
2. **Unit prices can be omitted.** `create_table_order` / `add_order_item` accept an optional `unitPrice` and fall back to the item’s current `sellingPrice`; the approved diff always shows the exact price used, so a later price change cannot silently alter an already-approved order.
3. **Composite guard is on the shared tool.** `record_sale` now rejects composite items for every vertical that can use it. Composites are a restaurant-only feature, and the guard message names a tool restaurants have; a non-restaurant org with a composite item would see the same message (the edge case is not reachable through the UI).
4. **Ingredient names key the diff.** The deduction rows are keyed by ingredient name and unit. Two different ingredients with the same name and unit in one dish would collapse into one row; recipe uniqueness is per item, and this is a presentation limitation only.
