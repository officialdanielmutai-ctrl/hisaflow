# HisaFlow — Assistant Redesign: Guest-House Vertical Implementation Note

**Directive:** `hisaflow-quality-and-assistant-overhaul.md`, Section 3.9 Phase E / Prompt D2-E (“remaining verticals”).
**Status:** Guest-house P0 (+P1 invoice) tool set ported and tested. Live shadow run + screenshots pending a seeded environment.
**Date:** 2026-10-12.
**Depends on:** Phase B/D/E foundation (`hisaflow-assistant-phase-b.md`, `hisaflow-assistant-phase-d.md`, `hisaflow-assistant-phase-e.md`).
**Predecessor verticals:** DUKA (`hisaflow-assistant-phase-b.md` §6), ISP (`hisaflow-assistant-isp-vertical.md`). Backlog source: `hisaflow-assistant-phase-a.md` §4.3 (GUEST_HOUSE).

---

## 1. What was built

All paths are relative to `apps/backend/src/modules/assistant/` unless stated.

| Piece | File | Notes |
|---|---|---|
| Guest-house tool set | `tools/guesthouse-assistant-tools.service.ts` | 17 tools, all `verticals: ['GUEST_HOUSE']`; writes only build proposals |
| Shared arg coercion | `tools/tool-args.ts` | Date/email helpers promoted here (`asDate`, `asOptionalDate`, `asOptionalEmail`) and reused by the ISP set |
| Module wiring | `assistant.module.ts` | Imports `BookingsModule`, `GuestsModule`, `RoomsModule`, `InvoicesModule` (all already export their services) and registers the third provider |

### 1.1 Tools

**Reads (auto-run, side-effect free):**

| Tool | Maps to | Purpose |
|---|---|---|
| `search_guests` | `GET /guests` (scoped) | resolve a guest name/phone to an ID |
| `list_rooms` | `GET /rooms` | resolve a room name to an ID; shows rate + status |
| `list_bookings` | `GET /bookings` | resolve a booking ID before check-in/out/charges |
| `get_arrivals_departures` | bookings by date | who arrives and departs on a day |
| `get_booking_invoice` | invoice by booking (read-only) | line items, payments and balance; **never creates** an invoice |

**Writes (proposal-only; commit calls the same domain service the manual UI calls):**

| Tool | Commits through | Risk | Roles |
|---|---|---|---|
| `create_guest` | `GuestsService.create` | low | OWNER, MANAGER, STAFF |
| `create_room` | `RoomsService.create` | medium | OWNER, MANAGER |
| `update_room` | `RoomsService.update` | medium | OWNER, MANAGER |
| `mark_room_dirty` / `mark_room_clean` | `RoomsService.update` | low | OWNER, MANAGER |
| `create_booking` | `BookingsService.create` | medium | OWNER, MANAGER, STAFF |
| `check_in_booking` | `BookingsService.checkIn` | medium | OWNER, MANAGER, STAFF |
| `check_out_booking` | `BookingsService.checkOut` | medium | OWNER, MANAGER, STAFF |
| `add_consumption` | `BookingsService.addConsumption` | medium | OWNER, MANAGER, STAFF |
| `generate_booking_invoice` | `InvoicesService.getDraftForBooking` | low | OWNER, MANAGER, STAFF |
| `record_booking_payment` | `InvoicesService.addPayment` | medium | OWNER, MANAGER, STAFF |
| `add_invoice_line_item` | `InvoicesService.addLineItem` | medium | OWNER, MANAGER |

Role gating mirrors the existing controllers (rooms = owner/manager; bookings, guests and payments = staff-inclusive). The vertical-agnostic foundation tools (`search_inventory`, `get_low_stock`, `create_note`, `send_email`, `send_sms`, `log_unsupported_intent`) remain available; `search_inventory` resolves the item ID for `add_consumption`.

> **Post-phase update 2026-10-14 (Q-017):** the shared inventory tools (`create_inventory_item`, `update_inventory_item`, `record_purchase`, `record_wastage`) were widened to **every** vertical, so a guest house can create/restock minibar and consumable stock directly. `add_consumption` remains the sale path. See `hisaflow-assistant-vertical-enablement.md`.

## 2. The single governed write path is unchanged

```
assistant chat → buildProposal (scoped lookups, no side effect)
              → Proposal(PROPOSED) → approve → execute
              → executor: tenant scope · APPROVED · argsHash immutability
                          · policy re-check · tool.commit (manual service)
```

`AssistantExecutorService` remains the only component that commits assistant actions. Guest-house tools add no second path — every `commit` calls `BookingsService`, `GuestsService`, `RoomsService` or `InvoicesService`, the same services used by `/bookings`, `/guests`, `/rooms` and the booking-invoice UI.

Diffs rendered by the Phase D card:
- check-in / check-out / room status → `status: { before, after }`
- `create_booking` → guest, room, dates, nights and estimated total
- `add_consumption` → `quantity: { before, after }` (insufficient stock refused at build)
- `record_booking_payment` → `balance: { before, after }` when an invoice already exists
- `add_invoice_line_item` → description, quantity, unit price and total

## 3. Registry

The registry now aggregates three providers (`AssistantToolsService`, `IspAssistantToolsService`, `GuestHouseAssistantToolsService`) behind `ASSISTANT_TOOL_PROVIDERS`. `assistant.module.spec.ts` compiles the real module graph and asserts the token yields three providers and that each org sees only its own vertical’s tools.

## 4. Honesty / behaviour rules

- **Read before write.** Write tools require server-resolved booking/guest/room/invoice IDs; ambiguity is a question, not a guess, and `log_unsupported_intent` catches the rest.
- **No force check-out.** The assistant can never pass `force=true`, so an unpaid balance blocks check-out and the proposal says so in its summary. The user can still force via the manual UI where authorised.
- **No invoice on read.** `get_booking_invoice` only reads; `generate_booking_invoice` is the explicit write that creates the draft (idempotent).
- **Model never supplies identity.** Org/user come from `AssistantContextService`; every lookup and commit is scoped by `ctx.organizationId`.
- **Suggestion chips are tool-derived**, so a guest house never sees DUKA/ISP chips and vice versa.

## 5. Tests + gates

- `tools/guesthouse-assistant-tools.service.spec.ts` — 28 tests: vertical gating for all 17 tools, owner/manager gating for room and invoice-line tools, org scoping, date-day boundaries for arrivals/departures, stock guard for consumption, balance projection, status-state guards (check-in/check-out), `force=false`, and commit calls through each service.
- `assistant.module.spec.ts` — three-provider aggregation + per-vertical isolation.
- `apps/frontend/lib/assistant.spec.ts` — guest-house labels + tool-derived chips (2 new tests).
- Gates: backend `tsc` + **97 suites / 720 Jest tests** + `nest build` + module ESLint (0 errors); frontend `tsc` + `next lint` (0 errors) + **144 vitest** + `next build`.

## 6. Remaining / deferred

- **P2** `send_checkout_reminder` (per-customer consent, high-risk) — depends on the per-customer consent store.
- **Live shadow run** on the guest-house characterization set with `assistant.shadow` (default off) — needs the seeded environment and the configured `hisaflow-assistant` gateway group.
- Live e2e + 7-viewport screenshots and streaming replies (carried over from Phases B–D).
- Remaining verticals: school, chemist, restaurant, wholesale.

## 7. Recorded limitations

1. **Create-guest → book chain.** `create_booking` takes an existing `guestId` (matching `POST /bookings`). The agent can propose `create_guest` and `create_booking` in one turn, but the booking cannot reference the new guest’s server-generated ID until the guest proposal is committed. So a brand-new guest is a two-step interaction (“add the guest”, then “book them”). A single-tool “create guest and book” is a domain change and is deliberately not introduced.
2. **Arrivals/departures use UTC day boundaries.** `get_arrivals_departures` slices the requested date at UTC midnight. A per-organisation timezone is a follow-up; the tool description asks for an explicit ISO date rather than guessing “today”.
3. **`addConsumption` ledger sign is pre-existing.** `BookingsService.addConsumption` writes a positive `quantityChange` while decrementing the item (outside this port’s scope). The assistant reuses the service unchanged so it never diverges from the manual UI; fixing the sign is a separate Duty 3 finding, not a Phase E change.
