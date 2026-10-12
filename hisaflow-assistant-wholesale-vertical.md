# HisaFlow — Assistant Redesign: Wholesaler Vertical Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E (“remaining verticals”).
**Status:** Wholesaler P0 (+P1 pricing/top-sellers) tool set ported and tested. Live shadow run + screenshots pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** Phase B/D/E foundation (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`, `hisaflow-assistant-phase-e.md`).
**Predecessor verticals:** DUKA (`hisaflow-assistant-phase-b.md` §6), ISP, guest house, school. Backlog source: `hisaflow-assistant-phase-a.md` §4.3 (WHOLESALER).

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/` unless stated.

| Piece | File | Notes |
|---|---|---|
| Wholesaler tool set | `tools/wholesale-assistant-tools.service.ts` | 7 tools, all `verticals: ['WHOLESALER']`; writes only build proposals |
| Shared stock movements | `tools/assistant-tools.service.ts` | `record_purchase` / `record_wastage` widened from retail to `['DUKA','MINI_MART','WHOLESALER']` (the transaction tool now takes a `verticals` override) |
| Module wiring | `assistant.module.ts` | Imports `FinanceModule`, `TieredPricingModule` and registers the fifth provider |

`record_sale` remains retail-only: wholesale sales need a client and optional credit, so the wholesaler has its own `record_wholesale_sale` / `record_bulk_sale`. Tool names are unique across the registry.

### 1.1 Tools

**Reads (auto-run, side-effect free):**

| Tool | Maps to | Purpose |
|---|---|---|
| `list_debtors` | `GET /finance/credits` (read-only query) | outstanding client credit balances |
| `list_packaging_units` | item packaging | resolve a carton/crate ID and its unit count |
| `get_top_sellers` | analytics wholesale logic | best-selling items over the last N days |

**Writes (proposal-only; commit calls the same domain service the manual UI calls):**

| Tool | Commits through | Risk | Roles |
|---|---|---|---|
| `record_wholesale_sale` | `TransactionsService.create` (SALE) | medium | OWNER, MANAGER, STAFF |
| `record_bulk_sale` | `TransactionsService.create` (SALE, cartons × packaging) | medium | OWNER, MANAGER, STAFF |
| `record_purchase` | `TransactionsService.create` (PURCHASE, shared tool) | low | OWNER, MANAGER, STAFF |
| `record_wastage` | `TransactionsService.create` (WASTAGE, shared tool) | medium | OWNER, MANAGER, STAFF |
| `record_credit_payment` | `CreditService.recordPayment` | medium | OWNER, MANAGER |
| `create_tiered_price` | `TieredPricingService.upsertRules` | medium | OWNER, MANAGER |

The vertical-agnostic foundation tools (`search_inventory`, `get_low_stock`, `create_note`, `send_email`, `send_sms`, `log_unsupported_intent`) remain available; `search_inventory` resolves the item ID for sales and pricing.

## 2. The single governed write path is unchanged

```
assistant chat → buildProposal (scoped lookups, no side effect)
              → Proposal(PROPOSED) → approve → execute
              → executor: tenant scope · APPROVED · argsHash immutability
                          · policy re-check · tool.commit (manual service)
```

`AssistantExecutorService` remains the only component that commits assistant actions. Wholesaler tools add no second path — every `commit` calls `TransactionsService`, `CreditService` or `TieredPricingService`, the same services used by the transactions, credits and tiered-pricing screens.

Diffs rendered by the Phase D card:
- sales → `quantity: { before, after }` plus client/credit in the summary
- bulk sales → the same, with cartons and converted base units in the summary
- `record_credit_payment` → `balance: { before, after }`
- `create_tiered_price` → the new tier list

Credit sales flow through the existing `TransactionsService.create({ isCredit: true, clientName, dueDate, creditNotes })`, which creates the `CreditRecord` and applies any tiered price — the assistant does not reimplement that logic.

## 3. Registry and shared tools

The registry now aggregates five providers (`AssistantToolsService`, `IspAssistantToolsService`, `GuestHouseAssistantToolsService`, `SchoolAssistantToolsService`, `WholesaleAssistantToolsService`) behind `ASSISTANT_TOOL_PROVIDERS`. `assistant.module.spec.ts` compiles the real module graph and asserts the token yields five providers, that a wholesaler sees the wholesaler tools plus the shared `record_purchase`/`record_wastage` (but not `record_sale`), and that other verticals do not see wholesaler tools.

## 4. Honesty / behaviour rules

- **Read before write.** Bulk sales require a resolved packaging unit; if the item has several and none is chosen, the tool refuses with the list rather than guessing. Credit sales require a client name.
- **Stock is checked at build time** for sales and bulk sales; insufficient stock is a build error, not a failed execution.
- **Shared stock movements.** Purchase and wastage are the same tools retail uses, widened to wholesalers; there is no wholesaler-only duplicate.
- **Model never supplies identity.** Org/user come from `AssistantContextService`; every lookup and commit is scoped by `ctx.organizationId`.
- **Suggestion chips are tool-derived**, so a wholesaler never sees other verticals’ chips and vice versa.

## 5. Tests + gates

- `tools/wholesale-assistant-tools.service.spec.ts` — 15 tests: vertical gating for all 7 tools, owner/manager gating for credit/pricing, org scoping, debtor balance filtering, packaging resolution (single / multiple / chosen), carton→unit conversion, credit-requires-client, stock guard, tier validation and the `inventoryItemId` attachment.
- `assistant.module.spec.ts` — five-provider aggregation + the shared purchase/wastage widening + per-vertical isolation.
- `apps/frontend/lib/assistant.spec.ts` — wholesaler labels + tool-derived chips (2 new tests).
- Gates: backend `tsc` + **99 suites / 760 Jest tests** + `nest build` + module ESLint (0 errors); frontend `tsc` + `next lint` (0 errors) + **148 vitest** + `next build`.

## 6. Remaining / deferred

- **P2** `send_statement(client)` (consent-gated) — depends on the per-customer consent store.
- **Live shadow run** on the wholesale characterization set with `assistant.shadow` (default off) — needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Live e2e + 7-viewport screenshots and streaming replies (carried over from Phases B–D).
- Remaining verticals: chemist, restaurant.

## 7. Recorded limitations

1. **Bulk sales need a packaging unit.** `record_bulk_sale` converts cartons to base units using `PackagingUnit.quantityPerUnit`. Items without packaging are rejected (use `record_wholesale_sale`); items with several packaging units require `packagingUnitId` from `list_packaging_units`.
2. **`create_tiered_price` replaces all tiers.** It calls `TieredPricingService.upsertRules`, which deletes the item’s existing tiers before inserting the supplied list. That matches the manual screen, but it means a partial “add one tier” request is really a full replacement; the card shows the whole new list.
3. **`record_credit_payment` writes a ledger entry.** `CreditService.recordPayment` also logs the payment as an INCOME business transaction. That is existing behaviour, so the assistant reuses the service unchanged.
4. **`list_debtors` reads Prisma directly.** `CreditService.findAll` opportunistically “auto-fixes” stale `$0` credits (a write on read), so the assistant debtors view uses a read-only Prisma query instead and never mutates while listing.
5. **Default credit term is not set by the assistant.** A credit sale without a `dueDate` is stored with no due date, matching the manual form; the assistant does not guess a term.
