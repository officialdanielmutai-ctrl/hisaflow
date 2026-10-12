# HisaFlow — Assistant Redesign: ISP Vertical Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E (“remaining verticals”).
**Status:** ISP P0 tool set ported and tested. Live shadow run + screenshots pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** Phase B/D/E foundation (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`, `hisaflow-assistant-phase-e.md`).
**Predecessor vertical:** DUKA (`hisaflow-assistant-phase-b.md` §6). Backlog source: `hisaflow-assistant-phase-a.md` §4.3 (ISP).

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/` unless stated.

| Piece | File | Notes |
|---|---|---|
| ISP tool set | `tools/isp-assistant-tools.service.ts` | 19 tools, all `verticals: ['ISP']`; writes only build proposals |
| Shared arg coercion | `tools/tool-args.ts` | Extracted from the DUKA tool set so both verticals validate identically (`asRecord`, `asString`, `asPositiveNumber`, `asEnum`, …) |
| Provider token | `tool.types.ts` | `AssistantToolProvider` + `ASSISTANT_TOOL_PROVIDERS` |
| Registry aggregation | `registry/tool-registry.service.ts` | Aggregates every registered provider; adding a vertical is “add a provider”, never an edit to the registry |
| Module wiring | `assistant.module.ts`, `../isp/isp.module.ts` | `IspModule` now exports its domain services; `AssistantModule` imports it and registers the ISP provider |

### 1.1 Tools

**Reads (auto-run, side-effect free):**

| Tool | Maps to | Purpose |
|---|---|---|
| `search_subscribers` | `GET /subscribers` (scoped) | resolve a name/phone to a subscriber ID |
| `list_service_plans` | `GET /service-plans` | resolve a plan name to a plan ID |
| `list_subscriber_invoices` | `GET /isp-invoices/subscriber/:id` | outstanding balance → invoice ID for payments |
| `list_work_orders` | `GET /work-orders` | resolve a work order ID before start/complete |
| `list_overdue_subscribers` | subscribers + invoices | unpaid invoice past due, with balance |
| `list_open_tickets` | `GET /tickets?status=OPEN` | resolve a ticket ID before resolving |

**Writes (proposal-only; commit calls the same domain service the manual UI calls):**

| Tool | Commits through | Risk | Roles |
|---|---|---|---|
| `create_subscriber` | `SubscribersService.create` | medium | OWNER, MANAGER |
| `assign_plan` | `SubscribersService.update` | medium | OWNER, MANAGER |
| `suspend_subscriber` / `reactivate_subscriber` | `SubscribersService.updateStatus` | medium | OWNER, MANAGER |
| `churn_subscriber` | `SubscribersService.updateStatus` | high | OWNER, MANAGER |
| `generate_subscriber_invoice` | `IspInvoicesService.generateForSubscriber` | medium | OWNER, MANAGER |
| `record_subscriber_payment` | `IspInvoicesService.recordPayment` | medium | OWNER, MANAGER |
| `issue_equipment` | `EquipmentService.issue` | medium | OWNER, MANAGER, STAFF |
| `create_work_order` | `WorkOrdersService.create` | low | OWNER, MANAGER, STAFF |
| `start_work_order` / `complete_work_order` | `WorkOrdersService.transition` | low | OWNER, MANAGER, STAFF |
| `create_ticket` | `TicketsService.create` | low | OWNER, MANAGER, STAFF |
| `resolve_ticket` | `TicketsService.transition` | low | OWNER, MANAGER, STAFF |

The vertical-agnostic foundation tools (`search_inventory`, `get_low_stock`, `create_note`, `send_email`, `send_sms`, `log_unsupported_intent`) remain available to ISP; `search_inventory` is what resolves equipment item IDs for `issue_equipment`. The DUKA stock tools stay retail-only.

## 2. The single governed write path is unchanged

```
assistant chat → buildProposal (scoped lookups, no side effect)
              → Proposal(PROPOSED) → approve → execute
              → executor: tenant scope · APPROVED · argsHash immutability
                          · policy re-check · tool.commit (manual ISP service)
```

There is still exactly **one** component that commits assistant actions (`AssistantExecutorService`). ISP tools add no second path: their `commit` calls `SubscribersService`, `IspInvoicesService`, `EquipmentService`, `WorkOrdersService` and `TicketsService` — the same services the `/subscribers`, `/subscribers/[id]`, `/work-orders` and `/tickets` screens call.

Proposals carry a plain-language summary and a before/after diff the Phase D card renders:
- status changes → `status: { before, after }`
- `assign_plan` → `plan: { before, after }`
- payments → `balance: { before, after }`
- equipment → `quantity: { before, after }` (insufficient stock is refused at build time)

High-risk churn uses the Phase D two-tap confirm automatically; financial and status tools are owner/manager-only and the policy gate re-checks role, vertical and the `assistant.write` flag at execution time.

## 3. Registry change (additive)

`ToolRegistryService` now takes the `ASSISTANT_TOOL_PROVIDERS` array instead of the single DUKA tool service. `AssistantModule` supplies `[AssistantToolsService, IspAssistantToolsService]` through a factory. No tool schema, proposal or executor behaviour changed; the DUKA tests and the foundation path are untouched.

## 4. Honesty / behaviour rules

- **Read before write.** Write tools are written to require server-resolved IDs; the system prompt already asks for one precise question instead of guessing, and `log_unsupported_intent` catches anything with no matching tool.
- **Model never supplies identity.** Organization and user come from `AssistantContextService`; the ISP tools scope every lookup and commit by `ctx.organizationId`.
- **No fake capability.** Only tools returned by `GET /assistant/tools` (vertical-filtered) produce suggestion chips, so an ISP org never sees a DUKA chip and vice versa.

## 5. Tests + gates

- `tools/isp-assistant-tools.service.spec.ts` — 22 tests: vertical gating for all 19 tools, owner/manager gating for the seven sensitive tools, org scoping, stock guard for `issue_equipment`, balance projection, email/method validation, and commit calls through each ISP service.
- `registry/tool-registry.service.spec.ts` — adds provider aggregation + vertical filtering across providers.
- `assistant.module.spec.ts` — compiles the real module graph and asserts the token yields both providers and that an ISP org sees the 19 ISP tools (and not `record_sale`) while a retail org sees the reverse.
- `apps/frontend/lib/assistant.spec.ts` — ISP labels + tool-derived chips (2 new tests).
- Gates: backend `tsc` + **96 suites / 691 Jest tests** + `nest build` + module ESLint (0 errors); frontend `tsc` + `next lint` (0 errors) + **142 vitest**.

## 6. Remaining / deferred

- **P1 ISP tools:** `test_router` / `router_suspend` (`POST /routers/:id/test`, `POST /subscribers/:id/router-suspend`) and `record_fleet_revenue` (ISP dashboard read).
- **P2:** `send_suspension_notice` (per-customer consent, high-risk).
- **Live shadow run** on the ISP characterization set with `assistant.shadow` (default off) — needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Live e2e + 7-viewport screenshots and streaming replies (carried over from Phases B–D).
- **Per-customer consent store** (Phase E §1 limitation) — ISP SMS/email recipients who are not Clerk users are treated as transactional until it exists.

### Recorded discrepancy
Phase A §5.1 drafted the ISP utterance “installed a router for John Doe” as `record_sale` with `clientName`. The Phase A §4.3 backlog — which is the parity list the owner approved — models the same action as `issue_equipment` linked to the subscriber, because that is the service that deducts inventory and ties the equipment to the subscriber’s record (the DUKA `record_sale` tool is retail-only and has no subscriber link). This note records that choice; a generic ISP wastage tool for “router burnt/written off” is **not** in the current set and stays a follow-up (it can be added by widening the retail `record_wastage` tool or adding an ISP-specific one).
