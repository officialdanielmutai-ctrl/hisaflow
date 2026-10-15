# HisaFlow — Rooms, Finance Breakdowns, Settings & Theme Upgrade

**Directive:** continuation of `hisaflow-quality-and-assistant-overhaul.md` (Duty 1 layout/UX, Duty 2 assistant, Duty 3 correctness).
**Status:** Implemented, tested. Five independently reviewable layers, each gated (lint, type-check, unit tests).
**Date:** 2026-10-15 (Layer 5 correction added same day).
**Defects:** Q-018 (room states/faults), Q-019 (finance accounting/ledger), Q-021 (finance Ledger explorer + dark contrast) — `hisaflow-overhaul-defect-log.md`.

This note records a session that added: a manual dark/light theme, a mobile
admin-panel Settings screen, changeable guest-house room states with mandatory
fault reporting, and vertical-aware finance breakdowns (plus an assistant read
tool for them). Work was done one layer at a time, each with its own tests.

---

## Layer 1 — Dark / light theme

**Problem:** the app was light-only; `globals.css` defined a single `:root`
token set and Tailwind had no `darkMode` strategy.

**What changed**

| File | Change |
|---|---|
| `apps/frontend/tailwind.config.ts` | `darkMode: 'class'` |
| `apps/frontend/lib/theme.ts` (new) | Pure helpers: `Theme`, `isTheme`, `resolveTheme`, `nextTheme`, storage key, and the no-flash bootstrap script |
| `apps/frontend/components/providers/ThemeProvider.tsx` (new) | Reads/persists the preference, toggles the `.dark` class + `data-theme` + `color-scheme` on `<html>` |
| `apps/frontend/app/globals.css` | Dark token overrides under `.dark` (core + marketing tokens + shadcn HSL vars) and a central bridge remapping the legacy `bg-white`/`gray` utilities |
| `apps/frontend/app/layout.tsx` | Injects `THEME_BOOTSTRAP_SCRIPT` before hydration (no flash) and wraps the app in `ThemeProvider` |

The theme is a **manual** preference (Settings → Appearance), default light,
persisted in `localStorage` under `hisaflow.theme`. The legacy utility bridge
exists because many older screens still use literal `bg-white`/`text-gray-*`
instead of the semantic tokens; new work uses the token classes and the bridge
shrinks as screens migrate.

**Guards:** `lib/theme.spec.ts` (4), `components/settings/ThemeToggle.spec.tsx` (1).

## Layer 2 — Settings as a mobile admin panel

`app/(dashboard)/settings/page.tsx` was reorganised into grouped cards
(Appearance · Business · Team · Hardware · Notifications · App) built from new
reusable pieces:

- `components/settings/SettingsGroup.tsx` — section label + divided card.
- `components/settings/SettingsRow.tsx` — `SettingsLinkRow` / `SettingsActionRow`
  (icon, title, description, trailing control/chevron).
- `components/settings/ThemeToggle.tsx` — light/dark segmented switch.

Existing behaviour (tax link, billing, staff, routers, push notifications, PWA
install) was preserved; the layout and hierarchy are now consistent and phone-first.

## Layer 3 — Guest-house room states & fault reporting

**Problem (Q-018, Sev2):** rooms rendered a state (Clean/Dirty/Occupied) but the
UI had no way to change it after creation, and there was no way to record that
something broke, what it was, or what it cost.

**Backend**

| Piece | Detail |
|---|---|
| `RoomStatus` | added `OUT_OF_ORDER` |
| `RoomIssue` model + `RoomIssueStatus` enum | `description` (required), `category`, optional `cost`, `status`, reporter/resolver ids, timestamps; org-scoped, room FK cascade |
| Migration | `20261016000000_add_room_issues` (add enum value + table; additive) |
| `CreateRoomIssueDto` | `description` required, `category` allow-listed, `cost` optional ≥ 0 |
| `RoomsService` | `listIssues`, `reportIssue` (creates the issue + sets the room `OUT_OF_ORDER` in one transaction), `resolveIssue` (resolves; restores `VACANT_DIRTY` only when no open issues remain) |
| `RoomsController` | `GET /rooms/:id/issues`, `POST /rooms/:id/issues` (OWNER/MANAGER/STAFF), `PATCH /rooms/issues/:issueId/resolve` (OWNER/MANAGER) |

**Frontend**

- `services/rooms.service.ts` — `RoomStatus` union incl. `OUT_OF_ORDER`,
  `RoomIssue` type and issue methods.
- `lib/room-status.ts` (new) — shared labels/badges/order (list, widget and
  detail now agree).
- `lib/room-issues.ts` (new) — pure validation: **the reporter's note is
  mandatory**, cost optional/non-negative.
- `components/guesthouse/ReportRoomIssueSheet.tsx` (new) — note (required),
  category, cost; submit reports the fault and takes the room out of service.
- `components/guesthouse/RoomStatusControl.tsx` (new) — quick status buttons,
  "Report fault", open faults with a Resolve action (owner/manager).
- `/rooms/[id]` renders the control; `/rooms` and `RoomStatusWidget` show the
  new state and a "Broken" count.

**Assistant:** `report_room_issue(roomId, description, category?, cost?)` added
to the guest-house tool set (18 tools), gated `GUEST_HOUSE`, manager roles;
commits through `RoomsService.reportIssue`.

**Guards:** `rooms.service.spec.ts` (+6 fault tests), `lib/room-issues.spec.ts`
(4), `guesthouse-assistant-tools.service.spec.ts` (+1, count 17→18).

## Layer 4 — Vertical-aware finance breakdowns

**Problem (Q-019, Sev2):** revenue/profit were computed only from
`inventoryTransaction` SALE rows, so invoiced verticals (guest house, ISP,
school) showed near-zero business profit and were carried by manually entered
"other income". The Ledger tab only offered a commodity breakdown (good for a
duka, meaningless elsewhere).

**Backend — `FinanceBreakdownService` (new)**

Normalises each vertical's P&L for a period:

```
revenue       = invoiced payments (guest house/ISP), fees + inventory (school),
                or inventory sales (retail/wholesale/chemist/restaurant)
cogs          = inventory SALE + WASTAGE at cost
grossProfit   = revenue − cogs
otherIncome   = manual INCOME
operating     = manual EXPENSE + room-issue repair costs
netProfit     = grossProfit + otherIncome − operating
```

It returns, per vertical:

- **revenue groups** — by room / by plan / by class / by commodity;
- **revenue mix** — room vs services (guest house);
- **maintenance by room** (guest house);
- **expenses by category** (incl. a synthetic `MAINTENANCE` row);
- **leaks** — wastage, repairs, uncollected invoices/fees, unpaid credit,
  chemist stock expiring within 30 days;
- a **daily revenue/COGS trend** built from inventory movements plus recorded
  payments, so the chart matches the headline for invoiced verticals.

`FinanceService.getBusinessOverview`, `getMonthSummary` and the new
`getBreakdown` now delegate to it, so the Overview, Month Comparison and
Breakdown all use the same vertical-aware numbers. New endpoint:
`GET /finance/breakdown?mode=rolling30|calendar`.

**Frontend**

- `services/business-finance.service.ts` — `FinanceBreakdown` types +
  `getFinanceBreakdown`, `MAINTENANCE`/`WASTAGE` category labels, corrected
  `totalOtherIncome` field.
- `components/finance/FinanceBreakdownPanel.tsx` (new) — period P&L, each
  vertical group as a labelled bar list, and a "Where money is leaking" card.
  *(Superseded in Layer 5: the panel repeated the Overview, so it was replaced
  by `FinanceExplorer`.)*
- `app/(dashboard)/finance/page.tsx` — the Ledger tab renders the panel above
  the existing commodity drill-down.

**Assistant:** `get_financial_breakdown` added to the shared foundation tool
set (every vertical, read-only). It returns the full vertical breakdown so the
assistant can answer revenue/profit/margin/leak questions from live figures
instead of inventing them.

**Guards:** `finance-breakdown.service.spec.ts` (4 vertical scenarios),
`finance.service.spec.ts` (updated fixtures + assertions),
`assistant-tools.service.spec.ts` (+1).

## Layer 5 — Finance Ledger explorer, inline assistant & dark contrast (Q-021)

**Problem (Q-021, Sev3):** Layer 4 placed `FinanceBreakdownPanel` at the top of
the Ledger tab. It was a near-copy of the Overview's P&L, so it added
scroll without adding information, and the Ledger still offered no way to look
up a single financial attribute. The dark palette's secondary/muted text and
borders were also low-contrast.

**Backend**

| Piece | Detail |
|---|---|
| `FinanceSearchService` (new) | Builds a searchable index of financial attributes from the existing vertical-aware breakdown (revenue by room/plan/class/commodity, expenses, maintenance) plus unpaid credit records and period ledger entries. Empty query returns the largest attributes; results are sorted by amount and capped at 25 with the full match count. Org-scoped. |
| `GET /finance/search?q=&mode=` | OWNER/MANAGER, returns `{ businessType, period, totalMatched, results }`. |
| `FinanceModule` | Registers and exports `FinanceSearchService`. |
| Assistant `search_business_finances` | Foundation read tool (all verticals) so the assistant can answer "how much did X earn/cost?" from live figures; maps to `{ type, label, context, amount, sharePct }`. |

**Frontend**

- `services/business-finance.service.ts` — `FinanceAttribute` /
  `FinanceSearchResult` types and `searchFinances`; removed the now-unused
  `FinanceBreakdown` UI types.
- `lib/finance-search.ts` (new) — attribute presentation metadata and the
  category-code → human-label helper, with tests.
- `components/finance/FinanceExplorer.tsx` (new) — debounced search over the
  financial attributes with type badges, amounts, share-of-total bars and
  example chips; the finance counterpart of the commodity breakdown.
- `components/finance/FinanceAskBox.tsx` (new) — inline "Ask about your
  finances" chat, prompt suggestions, and a link to `/assistant` when the
  assistant drafts a change.
- `app/(dashboard)/finance/page.tsx` — the Ledger tab drops the duplicated
  P&L panel and renders `FinanceExplorer` next to the commodity breakdown,
  followed by `FinanceAskBox`.
- `lib/assistant.ts` — `search_business_finances` label + suggestion chip.

**Dark mode contrast** — `.dark` tokens retuned and `--color-accent-foreground`
added, so body text is AAA and secondary/muted text and white-on-accent are AA
on the card surface; borders were lifted from `#2a343f` to `#3e4a57`.
`lib/dark-contrast.spec.ts` parses the `.dark` block and asserts the WCAG
ratios (primary ≥ 7:1, secondary/muted ≥ 4.5:1, white-on-accent ≥ 4.5:1,
accent/border UI ≥ 3:1 / 1.5:1), so the palette cannot silently regress.

**Guards:** `finance-search.service.spec.ts` (3), `FinanceExplorer.spec.tsx`
(1), `FinanceAskBox.spec.tsx` (1), `lib/finance-search.spec.ts` (3),
`lib/dark-contrast.spec.ts` (5), `assistant-tools.service.spec.ts` (+1).

**Gates (Layer 5):** backend `tsc --noEmit` pass; backend `eslint` on changed
modules 0 errors; `jest src/modules/finance src/modules/assistant` **26 suites /
257 tests** pass; frontend `tsc --noEmit` pass; `next lint` 0 errors; vitest
**33 files / 189 tests** pass.

---

## Gates

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | Pass |
| Backend `eslint` (changed modules, no `--fix`) | 0 errors (warnings only, matching baseline) |
| Backend unit tests | **104 suites / 826 tests** (baseline 103/814) |
| Frontend `tsc --noEmit` | Pass |
| Frontend `next lint` | 0 errors (warnings only) |
| Frontend tests | **30 files / 181 vitest** (ran with `--pool=forks` on this Windows host; default pool in CI) |
| Prisma schema | `prisma validate` passes; additive migration `20261016000000_add_room_issues` |

## Deferred / follow-ups

- Backend e2e (`test/assistant-lifecycle.e2e-spec.ts`) and the Playwright
  screenshots need the seeded/Postgres environment in CI; not runnable on this
  host.
- The dark-mode legacy utility bridge is transitional; screens should migrate
  to the semantic tokens and the bridge should shrink.
- Finance breakdown currency is assumed KES in the UI (matching the rest of the
  app); per-org currency formatting is a separate polish item.
- A stock write-off that is **also** entered manually as a `WASTAGE` business
  transaction would be double-counted; the finance UI only auto-adds room-issue
  repair costs, not manual duplicates.
