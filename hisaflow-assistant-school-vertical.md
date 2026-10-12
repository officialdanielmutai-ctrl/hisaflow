# HisaFlow — Assistant Redesign: School Vertical Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E (“remaining verticals”).
**Status:** School P0 (+P1 invoice) tool set ported and tested. Live shadow run + screenshots pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** Phase B/D/E foundation (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`, `hisaflow-assistant-phase-e.md`).
**Predecessor verticals:** DUKA (`hisaflow-assistant-phase-b.md` §6), ISP (`hisaflow-assistant-isp-vertical.md`), guest house (`hisaflow-assistant-guesthouse-vertical.md`). Backlog source: `hisaflow-assistant-phase-a.md` §4.3 (SCHOOL).

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/` unless stated.

| Piece | File | Notes |
|---|---|---|
| School tool set | `tools/school-assistant-tools.service.ts` | 15 tools, all `verticals: ['SCHOOL']`; writes only build proposals |
| Module wiring | `assistant.module.ts` | Imports `StudentsModule`, `SchoolClassesModule`, `SchoolFeesModule` (all already export their services) and registers the fourth provider |

Terms and classes are read through Prisma under the org scope; students and fee invoices go through the domain services.

### 1.1 Tools

**Reads (auto-run, side-effect free):**

| Tool | Maps to | Purpose |
|---|---|---|
| `search_students` | `GET /students` (scoped) | resolve a student name/admission number to an ID |
| `list_classes` | `GET /school-classes` | resolve a class ID; shows student counts |
| `list_academic_terms` | `GET /academic-terms` | resolve a term ID; shows fee-structure/invoice counts |
| `list_fee_defaulters` | `GET /school-fees/term/:id/defaulters` | outstanding balances for a term |
| `get_fee_summary` | `GET /school-fees/term/:id/summary` | expected/collected/outstanding by class |
| `list_fee_invoices` | `GET /school-fees/student/:id`, `term/:id` | resolve an invoice ID and its balance |

**Writes (proposal-only; commit calls the same domain service the manual UI calls):**

| Tool | Commits through | Risk | Roles |
|---|---|---|---|
| `create_student` | `StudentsService.create` | low | OWNER, MANAGER, STAFF |
| `update_student` | `StudentsService.update` | low | OWNER, MANAGER, STAFF |
| `create_class` | `SchoolClassesService.create` | low | OWNER, MANAGER |
| `update_class` | `SchoolClassesService.update` | low | OWNER, MANAGER |
| `generate_fee_invoices` | `SchoolFeesService.generateForTerm` | medium | OWNER, MANAGER |
| `record_fee_payment` | `SchoolFeesService.recordPayment` | medium | OWNER, MANAGER, STAFF |
| `issue_fee_invoice` | `SchoolFeesService.issueInvoice` | low | OWNER, MANAGER |
| `void_fee_invoice` | `SchoolFeesService.voidInvoice` | high | OWNER, MANAGER |
| `record_supply_issue` | `TransactionsService.create` (SALE) | medium | OWNER, MANAGER, STAFF |

The vertical-agnostic foundation tools (`search_inventory`, `get_low_stock`, `create_note`, `send_email`, `send_sms`, `log_unsupported_intent`) remain available; `search_inventory` resolves the item ID for `record_supply_issue`.

## 2. The single governed write path is unchanged

```
assistant chat → buildProposal (scoped lookups, no side effect)
              → Proposal(PROPOSED) → approve → execute
              → executor: tenant scope · APPROVED · argsHash immutability
                          · policy re-check · tool.commit (manual service)
```

`AssistantExecutorService` remains the only component that commits assistant actions. School tools add no second path — every `commit` calls `StudentsService`, `SchoolClassesService`, `SchoolFeesService` or `TransactionsService`, the same services used by `/students`, `/school-classes` and the fee screens.

Diffs rendered by the Phase D card:
- `generate_fee_invoices` → active students, already-invoiced, and how many will be created
- `record_fee_payment` → `balance: { before, after }`
- `issue_fee_invoice` / `void_fee_invoice` → `status: { before, after }`
- `record_supply_issue` → `quantity: { before, after }` (insufficient stock refused at build)

## 3. Registry

The registry now aggregates four providers (`AssistantToolsService`, `IspAssistantToolsService`, `GuestHouseAssistantToolsService`, `SchoolAssistantToolsService`) behind `ASSISTANT_TOOL_PROVIDERS`. `assistant.module.spec.ts` compiles the real module graph and asserts the token yields four providers and that each org sees only its own vertical’s tools.

## 4. Honesty / behaviour rules

- **Read before write.** Write tools require server-resolved student/class/term/invoice IDs; ambiguity is a question, not a guess, and `log_unsupported_intent` catches the rest.
- **Fee-invoice state respected.** `record_fee_payment` refuses `DRAFT`/`VOIDED` invoices at build time (matching `SchoolFeesService`), so a payment is only proposed against an issued invoice.
- **Generation is idempotent.** `generate_fee_invoices` reports and skips already-invoiced students; the commit relies on the existing per-student/term uniqueness.
- **Void is high-risk.** `void_fee_invoice` is marked high-risk so the Phase D card requires the two-tap confirm.
- **Model never supplies identity.** Org/user come from `AssistantContextService`; every lookup and commit is scoped by `ctx.organizationId`.
- **Suggestion chips are tool-derived**, so a school never sees DUKA/ISP/guest-house chips and vice versa.

## 5. Tests + gates

- `tools/school-assistant-tools.service.spec.ts` — 23 tests: vertical gating for all 15 tools, owner/manager gating for the structural and invoice tools, org scoping, class/term verification, defaulter balance filtering, partial updates, invoice-state guards, balance projection, and commit calls through each service.
- `assistant.module.spec.ts` — four-provider aggregation + per-vertical isolation.
- `apps/frontend/lib/assistant.spec.ts` — school labels + tool-derived chips (2 new tests).
- Gates: backend `tsc` + **98 suites / 744 Jest tests** + `nest build` + module ESLint (0 errors); frontend `tsc` + `next lint` (0 errors) + **146 vitest** + `next build`.

## 6. Remaining / deferred

- **P2** `send_fee_reminder` (bulk, consent-gated) — depends on the per-customer consent store and a bulk-send governance decision.
- **Live shadow run** on the school characterization set with `assistant.shadow` (default off) — needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Live e2e + 7-viewport screenshots and streaming replies (carried over from Phases B–D).
- Remaining verticals: chemist, restaurant, wholesale.

## 7. Recorded limitations

1. **No term/fee-structure management tool.** `generate_fee_invoices` assumes a term with fee structures exists (created via the term UI). Creating/adjusting terms and fee structures is out of the backlog and is not offered by the assistant.
2. **Issue-then-pay is a two-step interaction.** A freshly generated invoice is `DRAFT`; `record_fee_payment` refuses to build against a `DRAFT`, so the user must approve `issue_fee_invoice` first and then ask to record the payment. The assistant says so rather than proposing an unusable payment.
3. **`record_supply_issue` is a generic SALE.** It deducts inventory with a free-text note but is not linked to a class or student record, because `POST /transactions` has no such field. A class/student-linked issue is a domain change and is deliberately not introduced.
4. **`void_fee_invoice` can void any status.** The existing service voids regardless of state (including `PAID`), so the assistant marks it high-risk and leaves the two-tap confirm as the guard.
