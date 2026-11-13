# HisaFlow — Open Findings (deferred, not dropped)

**Purpose:** A single place to record issues flagged during an agent-driven
build that are real, but are not in the current layer's declared scope. Nothing
here is "wontfix" — it is "deal with later, deliberately and with a tracking
id". Add a row when something is flagged; update the row (do not delete it)
once it is resolved, with a PR/date note.

**Status values:** `Open` · `In progress` · `Resolved` · `Accepted risk`
**Severity:** `Blocker` · `High` · `Medium` · `Low` · `Info`

*Last updated: 2026-11-06*

---

## 1. Findings index

| ID | Area | Severity | Status | Summary |
|---|---|---|---|---|
| F-01 | Paywall / pricing | High | Open | Growth tier has no price in the doc set — Paystack Plan and self-serve checkout are disabled for it (not fabricated). |
| F-02 | Paywall / Paystack | Medium | Open | Live test-mode verification (real dashboard webhook event, real auto-renewal) not performed — no `PAYSTACK_SECRET_KEY`/network in this environment. |
| F-03 | Frontend / testing | Low | Resolved (2026-09-30) | Frontend gained a `node:test` runner (`npm test`); it covers the pure paywall/billing helpers, not React components yet. |
| F-04 | Repo-wide lint debt | Medium | Resolved (2026-09-30) | Backend and frontend linters now both report **0 errors**; see Section 2. Warnings (`no-explicit-any`, unused vars) remain a separate, larger cleanup. |
| F-05 | Paywall / trials | Medium | Open | paywall doc Section 6 (free trial out of scope) conflicts with Section 7 item 2 (14-day trial defaulted). Reconcile before building trial logic. |
| F-06 | Paywall / webhooks | Medium | Open | Webhook event processing is in-process fire-and-forget after the 200; a crash in that window leaves a `WebhookEvent` stuck at `RECEIVED` with no sweep/recovery job. |
| F-07 | Paywall / Phase E | Low | Open | `ensurePaystackPlanCode` reuses a stored Paystack plan code even if the tier price later changes; no amount reconciliation/plan-update path yet (Phase E). |
| F-08 | Repo / CI | Medium | Open | No CI workflows are configured (`.github/workflows` absent), so Section 1.3's "branch must pass CI" gate has nothing to run. |
| F-09 | Paywall / Phase C | Info | Resolved (2026-09-30) | M-Pesa is now enabled in the paywall UI. |
| F-10 | Paywall / Phase C | High | Resolved (2026-09-30) | `POST /paywall/checkout/mpesa` + first-charge webhook create the M-Pesa Subscription the renewal loop needs. |
| F-11 | Paywall / scheduling | Low | Open | `ScheduleModule.forRoot()` is registered in the ISP module; the paywall cron job implicitly depends on it. Move the scheduler root to `AppModule`. |
| F-12 | Paywall / seats | Medium | Open | Per-seat overage rate is undefined (`HisaflowPlan.perSeatOverageKes` is null), so Team overage is tracked/billed-at-zero; card overage cannot be auto-billed via native recurring at all. |
| F-13 | Paywall / trials | Medium | Open | No-subscription orgs are treated as the Team trial indefinitely (trial expiry is out of scope), so they keep Team entitlements without paying. |
| F-14 | Paywall / Phase E | Low | Resolved (2026-09-30) | Receipt history pulls Paystack's Transactions list (`GET /transaction` by resolved customer id), with a local `PaymentAttempt` fallback when Paystack is unreachable. |
| F-15 | Paywall / Phase E | Medium | Open | Upgrade / rail-switch disables the old card Paystack subscription *before* the replacement checkout is paid; an abandoned checkout leaves no active auto-renew. |
| F-16 | Repo / Prisma | Medium | Open | Migration history is stale: paywall and tax tables exist only via `prisma db push`; no migration under `prisma/migrations` creates them. |
| F-17 | Tax / KRA | Medium | Open | eTIMS registration status is recorded from what the owner reports on KRA's portal — HisaFlow does not independently verify it against KRA yet (Phase C). |
| F-18 | Tax / scope | Low | Accepted risk | OSCU can be stored as an integration type but is unsupported (out of scope, Section 6); the UI warns and live filing stays off. |
| F-19 | Tax / calculation | Medium | Open | Phase B applies standard 16% VAT (tax-inclusive) to any org with a `TaxRegistration`; no zero-rated/exempt items or turnover/simplified-regime distinction yet (deliberately deferred, Section 7 item 3). |
| F-20 | Tax / scope | Medium | Open | `FeeInvoice` (school fees) is a separate model and is not covered by the `InvoiceTaxService` choke point, so school fee invoices calculate no tax. |
| F-21 | Tax / KRA | Medium | Open | Live VSCU/KRA request contract (auth, exact payload/response, transmit endpoint) is unverified — no credentials/sandbox in this environment; only the failure classification + queue logic are mock-verified. |
| F-22 | Tax / multi-branch | Low | Open | VSCU signing uses branch id `00` (head office) from config; per-branch signing for multi-location orgs is Phase F. |
| F-23 | Tax / credit notes | Low | Open | The Tax tab excludes VOIDED invoices and does not represent eTIMS credit notes; full credit-note handling is out of scope (Section 6). |
| F-24 | Tax / reconciliation | Low | Resolved (2026-09-30) | Reconciliation now carry-forwards any period with an open anomaly and only clears an alert once its invoice was actually re-checked. |
| F-25 | Tax / tiering | Medium | Resolved (2026-09-30) | Docs reconciled: Phase F / T-F headings and the paywall §1A Tax row now say Growth multi-location, matching the reused `TierFeature.MultiLocation` gate. |
| F-26 | Tax / locations | Low | Accepted risk | Multi-location tax derives its location from the ISP `Router` + a "Main location" fallback; guest-house multi-property is out of scope, so there is nothing to group by yet. |
| F-27 | Landing / trust | Blocker | Resolved (2026-11-03) | Landing page no longer claims owner M-Pesa payments are automatically matched. Copy now says "Record M-Pesa in one place" / "One daily total for every payment"; the reconciliation feature remains unbuilt and unclaimed. |
| F-28 | Inventory / audit | Blocker | Resolved (2026-11-06) | Quantity edits now write an `ADJUSTMENT` `InventoryTransaction` (before/change/after + actor) in the same transaction as the projection; metadata-only edits do not write a false movement. |
| F-29 | Restaurant / Chemist / Wholesale / School | Blocker | Resolved (2026-11-06) | All remaining relative `/api/...` fetches now go through `apiGet/apiPost`; the sheets are reachable from Edit Variant or the vertical page. |
| F-30 | School fees / UI | High | Resolved (2026-11-06) | The three tabs render live backend data, DRAFT invoices can be issued, and student detail loads through `/students/:id` and records payments. |
| F-31 | Data ownership / export | High | Resolved (2026-11-06) | Tenant-scoped `/exports/:dataset` CSV endpoints plus Settings → Your data downloads for inventory, ledger, invoices, fee invoices, credit and tax. |
| F-32 | ISP / billing cycle | High | Resolved (2026-11-06) | `IspBillingCycleJob` generates and issues one invoice per active subscriber per anchored cycle, idempotently. |
| F-33 | Retail / payments | High | Open | Retail sales have no payment method, no end-of-day/shift close and no sale receipt; card/M-Pesa/cash totals cannot be separated. |
| F-34 | Restaurant / workflow | High | In progress | Table orders are API-wired with add-item and ledgered close; recipe editor, kitchen/prepared state, split payment and dish margin/variance remain open. |
| F-35 | Chemist / safety | High | In progress | Batch receipt is now reachable, but free-text units, expired-batch sale guard, batch-specific write-off and money-at-risk reporting remain open. |
| F-36 | Guest house / billing | Medium | Open | Consumption deducts stock but is not priced into the invoice; issued invoices are not immutable snapshots. |
| F-37 | Field verification / hardware | Medium | Open | Real MikroTik cut/restore and installed-iOS camera/PWA paths remain unverified; code and mocked tests pass, but no field evidence exists. |
| F-38 | ISP / plan cycles | Low | Resolved (2026-11-06) | Service-plan UI offered `DAILY`/`WEEKLY`/`ANNUAL` while the Prisma enum only has `MONTHLY`/`QUARTERLY`/`ANNUALLY`; the UI and frontend type now match the database. |
| F-39 | ISP / deployment | High | Resolved (2026-11-10) | `ROUTER_ENCRYPTION_KEY` was added to the Northflank API service and the service restarted; a real MikroTik field test is still pending. |
| F-40 | AI gateway / deployment | High | Resolved (2026-11-13) | The official LiteLLM proxy OOM-killed on Northflank’s 512 MB plan and the free allowance cannot fit 1 GB beside the API. The gateway moved to Cloud Run `hisaflow-litellm` (2 GiB, min 0 / max 2, request-based billing); the Northflank gateway was removed. |
| F-41 | AI gateway / keys | High | Resolved (2026-11-10) | The gateway `.env` Gemini key returned 403; the API service's valid Gemini key was copied in. Standard, assistant, vision and streaming calls now return 200. |
| F-42 | AI gateway / backend | High | Resolved (2026-11-13) | The backend `LITELLM_BASE_URL` pointed at a dead Railway URL; it now points at the Cloud Run gateway `https://hisaflow-litellm-cgqiivalxa-ew.a.run.app/v1` with the matching master key. |
| F-43 | AI gateway / redeploy | Medium | Open | The Cloud Run MCP `deploy_container_image` tool only accepts image/project/region/service; it does not preserve command, env, memory or scaling. A naive redeploy would reset the service to defaults. |
| F-44 | Assistant / reporting & advice | High | Resolved (2026-11-13) | The assistant could not answer sales questions or analyse the catalogue, its shared tool set stopped at inventory/finance reads, and replies rendered Markdown/JSON as raw code. Added sales, purchase, catalogue, credit, expense, alert, recent-activity, notes, tax and team read tools plus governed `resolve_alert`, `record_expense`, `record_income`, `adjust_stock`, `archive_inventory_item` and shared `record_credit_payment`; prompted for practical advice with safety limits; and replaced raw Markdown/code fences with natural prose, labelled data rows and readable tables. |

---

## 2. Repo-wide lint errors (F-04) — resolved

These were pre-existing and outside every phase's declared scope. They were the
reason a repo-wide `lint` run was not green even though each shipped layer's own
files lint clean.

**Resolved (2026-09-30):** a dedicated, behaviour-preserving lint-debt pass
brought both linters to **0 errors**. Reproduce:

```bash
# Backend (0 errors)
cd apps/backend && npx eslint "src/**/*.ts"

# Frontend (0 errors)
cd apps/frontend && npx next lint
```

What was fixed, by category (no logic changed):

- **`@typescript-eslint/ban-types` (backend, 2):** `Function` →
  `Type<unknown>` in `core/pipes/validation.pipe.ts`.
- **`@typescript-eslint/no-var-requires` (backend 3, frontend 1):** moved the
  lazy `require('routeros-client')` and `require('@/services/credit.service')`
  to top-level `import`s (both ship types / are local modules).
- **`prefer-const` (backend, 2):** `batchTxs` / `batchDeductions` in
  `transactions.service.ts`.
- **`react/no-unescaped-entities` (frontend, 22):** replaced the literal
  `"`/`'` in JSX text with `&quot;`/`&apos;` — identical rendering.
- **`no-empty` (frontend, 9):** added an explanatory comment inside each
  intentionally-empty block (a comment satisfies the rule; no logic change).
- **`@typescript-eslint/ban-ts-comment` (frontend, 1):** `@ts-ignore` →
  `@ts-expect-error` with a description in `BarcodeScannerSheet.tsx`.

Verification: backend 158/158 tests, frontend 35/35, both `tsc` and production
builds clean. Warnings (e.g. `no-explicit-any`, `no-unused-vars`) are **not**
part of F-04 and remain as a separate, larger cleanup.

> Historical: two `lib/api-client.ts` `no-empty` errors were fixed during Phase D
> (37 → 35), and the `invoices.service.ts` `prefer-const` during Phase B
> (8 → 7). The remaining 7 backend / 35 frontend errors were fixed in the
> 2026-09-30 lint-debt pass above.

> Note: the configured frontend linter is `next lint` (lints `app/`,
> `components/`, `lib/`). The backend's configured `lint` script uses `--fix`;
> run it only as part of an intentional change since it mutates files.

---

## 3. Finding details

### F-01 — Growth tier has no price
- **Where:** `hisaflow-paywall.md` Section 7 item 1 fixes only Solo (2,500) and
  Team (5,500). Growth is defined structurally in Section 1 but never priced.
- **Impact:** `HisaflowPlansService.syncPaystackPlans()` skips Growth; the
  paywall shows Growth as a non-purchasable "Custom" card.
- **Why not fixed now:** fabricating a price is explicitly warned against in
  the doc. This is a business decision.
- **Resolution:** set Growth `priceKes` + `isActive = true`, then run
  `POST /admin/paywall/plans/sync` (or `HisaflowPlansService.syncPaystackPlans`).

### F-02 — Live Paystack test-mode verification not performed
- **Where:** Phase A "Done when" (dashboard test event), Phase B "Done when"
  (test-mode card auto-renewal), Phase C "Done when" (test M-Pesa renewal).
- **Impact:** HisaFlow-side behavior is covered by unit/integration tests; the
  external Paystack round-trip has not been run in this environment. Phase C's
  Charge API (`POST /charge`, `mobile_money.provider = mpesa`) is likewise
  verified against a mocked client, not the live sandbox.
- **Resolution:** once `PAYSTACK_SECRET_KEY` (test mode) is set, send a
  dashboard test event and run one real test-mode card + M-Pesa cycle. Also
  confirm Paystack's `POST /charge` mobile_money payload/response shape against
  current docs at that time (it is the one Phase C external contract not
  re-verified live).

### F-03 — Frontend has no test runner
- **Where:** `apps/frontend/package.json` had no `test` script and no
  jest/vitest/testing-library dependencies.
- **Impact:** Section 1.5 item 2 ("new functionality has its own tests") could
  not be met for frontend layers; verification was `next build` + `next lint`.
- **Resolution (2026-09-30):** added a zero-dependency `node:test` runner
  (`npm test`) covering the pure helpers (`lib/paywall-context.test.ts`,
  `lib/feature-lock.test.ts`, and Phase E's `lib/billing.test.ts`) — 13 tests.
  Caveat recorded so it is not over-read: this does **not** cover React
  components/rendering; a component-level harness (Testing Library/Vitest)
  remains a future decision if component tests are required.

### F-05 — Free-trial scope conflict
- **Where:** `hisaflow-paywall.md` Section 6 lists free-trial mechanics as out
  of scope; Section 7 item 2 defaults a 14-day trial.
- **Impact:** trial logic must not be built until the two sections agree.
- **Resolution:** reconcile the doc sections before any trial work.

### F-06 — Webhook async processing durability
- **Where:** `apps/backend/src/modules/paywall/webhooks/paystack-webhook.controller.ts`
  and `paystack-webhook.service.ts`.
- **Impact:** the 200 is returned after the raw event is logged, then processing
  runs in-process (`void ...processEvent`). A crash in that window leaves the
  row at `RECEIVED` forever (no worker/queue/sweep).
- **Resolution:** add a periodic sweep for stale `RECEIVED` events, or move
  processing onto the existing job/queue infra. Phase F2's admin retry also
  gives a manual recovery path.

### F-07 — Paystack plan price drift
- **Where:** `HisaflowPlansService.ensurePaystackPlanCode()` reuses a stored
  `paystackPlanCode` without checking the live Paystack amount. Phase E's
  upgrade/downgrade paths call the same method.
- **Impact:** if a tier price changes after the plan is created, checkout amount
  and Paystack plan amount can diverge.
- **Resolution:** compare/update the Paystack Plan when pricing changes. Phase E
  (2026-09-30) did **not** add amount reconciliation — the doc's Phase E scope
  was plan changes/seats/method/receipts, so this remains open. Note Paystack's
  `Update Plan` does support an `update_existing_subscriptions` flag if an
  integration-wide price change is ever wanted, but that is a business action,
  not a per-org one.

### F-08 — No CI configured
- **Where:** no `.github/workflows/` (or equivalent) in the repo.
- **Impact:** Section 1.3's "branch must pass CI before Done" cannot be
  evidenced; only local build/test/lint runs exist.
- **Resolution:** add CI running the root `build`/`lint` plus backend `test`.

### F-10 — Initial M-Pesa checkout not built
- **Where:** Phase C build brief scopes only the scheduled renewal job; the
  paywall's M-Pesa flow (which creates the first `Subscription` with
  `paymentMethod = MPESA` and captures `mpesaPhone`) had no backend endpoint.
- **Impact:** `MpesaRenewalService` is complete and tested, but in production
  there was no way to create an M-Pesa subscription for it to renew.
- **Resolution (2026-09-30):** added `MpesaCheckoutService` and
  `POST /paywall/checkout/mpesa` (Paystack checkout page via
  `channels: ['mobile_money']`, no plan — Section 3.3), and
  `MpesaRenewalService.handleChargeSuccess` now creates the `Subscription` on
  the first `charge.success`. Tests: `mpesa-checkout.service.spec.ts` and
  `mpesa-renewal-first-charge.spec.ts` (50 backend tests total).

### F-11 — Scheduler root lives in the ISP module
- **Where:** `apps/backend/src/modules/isp/isp.module.ts` imports
  `ScheduleModule.forRoot()`; `MpesaRenewalJob` (paywall Phase C), Phase E's
  `PlanChangeJob` (paywall), and Layer T-C's `TaxSyncJob` all rely on that global
  registration for their `@Cron` decorators to be discovered.
- **Impact:** removing/refactoring the ISP module would silently stop the
  billing, plan-change and eTIMS-sync crons.
- **Resolution:** move `ScheduleModule.forRoot()` to `AppModule` (one line) and
  drop it from `IspModule`.

### F-12 — Per-seat overage rate undefined
- **Where:** `hisaflow-paywall.md` Section 1 leaves the per-seat overage rate
  blank and Section 7 item 4 only fixes the *behaviour* (auto-bill, do not
  block). `HisaflowPlan.perSeatOverageKes` is therefore nullable and null.
- **Impact:** Phase D tracks the overage (`Subscription.seatCount >
  seatAllowance`, `EntitlementsService.assertSeatAvailable` returns
  `autoBilled: true`) and the M-Pesa renewal includes it *when priced*, but
  today that adds KES 0. Card overage additionally cannot be charged without a
  Paystack plan/amount change (Phase E). Phase E (2026-09-30) added self-serve
  seat add/remove (`PATCH /paywall/seats`, `BillingService.updateSeats`) and
  preserves purchased seats across tier changes — but seats above the
  allowance still bill at KES 0 until a rate is set.
- **Resolution:** set `perSeatOverageKes` per tier; decide the card overage
  mechanism in Phase E follow-up (F-15 area).

### F-13 — Trial entitlement never expires
- **Where:** `EntitlementsService.resolve()` treats a missing `Subscription` as
  the defaulted 14-day Team trial so new orgs are not blocked.
- **Impact:** trial-expiry logic is out of scope, so an org that never picks a
  plan keeps Team-grade entitlements indefinitely.
- **Resolution:** build trial start/expiry (blocked on the Section 6 vs 7
  reconciliation, F-05) and return the expired org to the Solo floor.

### F-14 — Receipt history source
- **Where:** Phase E `BillingService.listInvoices()` / `GET /paywall/invoices`.
- **Implemented (2026-09-30):** receipts are now pulled from **Paystack's
  Transactions list**. Because Paystack's `GET /transaction` `customer` filter
  takes a numeric customer id, the stored `CUS_` code is resolved via
  `GET /customer/:code` first; rows are mapped (channel → method, status →
  `PaymentAttemptStatus`, amount → KES) and enriched with the local plan name
  by matching the Paystack `reference` against `PaymentAttempt`.
- **Fallback (deliberate):** if Paystack is not configured/unreachable, or
  returns no rows, the endpoint falls back to the `PaymentAttempt` audit trail so
  the screen never goes blank. The response carries `source: 'paystack' |
  'local'` and the UI says which it used.
- **Remaining note:** live Paystack round-trip is still unverified in this
  environment (F-02); the Paystack path is covered by mocked tests only.

### F-15 — Abandoned upgrade/rail-switch can leave no active auto-renew
- **Where:** `BillingService.changePlan()` (card upgrade) and
  `changePaymentMethod()` disable the old Paystack subscription **before** the
  replacement checkout is paid. This is the disable-old/create-new pattern the
  doc mandates in the absence of a change-plan endpoint.
- **Impact:** if the customer starts an upgrade / rail switch and abandons
  checkout, the old Paystack auto-renew is already cancelled while HisaFlow is
  still ACTIVE locally — a card renewal could silently lapse. M-Pesa is not
  affected (the local loop owns renewal).
- **Why not fixed now:** the safe alternatives have their own hazards (leaving
  the old subscription live risks a double charge; disabling only after the new
  success needs webhook orchestration). Recorded deliberately rather than
  silently accepted.
- **Resolution:** on `subscription.create`/`charge.success` for the replacement,
  re-enable or reconcile; or add a sweep that re-enables the old subscription if
  a pending upgrade checkout is abandoned. Best verified with live Paystack
  (F-02).

### F-16 — Prisma migration history is stale
- **Where:** `apps/backend/prisma/migrations/` contains only 6 migrations
  (init → `add_product_catalog_entry`, 2026-08-10). None creates
  `hisaflow_plans` / `subscriptions` / `payment_attempts` / `webhook_events`,
  Phase E's `pending_tier` / `pending_plan_effective_at`, Layer T-A's
  `tax_registrations` table plus its `Etims*` enums, Layer T-B's
  `invoices.tax_total` / `invoice_line_items.net_amount|tax_amount|tax_rate`,
  or Layer T-C's `tax_invoice_records` / `tax_sync_queue` tables and enums.
- **Impact:** the paywall and tax schema exists only via the
  `prestart` `prisma db push --accept-data-loss` path. A `prisma migrate deploy`
  path would not create these tables, and adding a standalone Phase E/T-A/T-B/T-C
  migration would not fix that — it would only add to the drift.
- **Resolution:** a dedicated change should baseline the migration history
  against the current schema (or formally adopt `db push` everywhere and delete
  the stale migration folder). Separate from these phases.

### F-17 — eTIMS status is recorded, not KRA-verified
- **Where:** `TaxRegistrationService` / `POST /tax/registration/kra-outcome`;
  `GET /tax/registration` returns whatever was recorded.
- **Impact:** Layer T-A has no KRA API integration, so an owner recording
  "KRA approved production" is trusted as-is. `canFileLive` therefore trusts a
  recorded status. The build mitigates the overstatement risk (no auto-advance;
  explicit note required; `PRODUCTION_ACTIVE` is the only live-filing state;
  the UI always shows "Live filing off" for pending states), but does not
  verify the claim.
- **Resolution:** Phase C's VSCU initialization/registration calls become the
  source of truth; until then this is deliberately recorded. Revisit when KRA
  credentials exist.

### F-18 — OSCU is storable but unsupported
- **Where:** `EtimsIntegrationType` enum admits `OSCU`; only VSCU is built
  (tax-system doc Section 2 / Section 6).
- **Impact:** an org that selected OSCU on the KRA portal can record it here;
  HisaFlow will not file for it. The `/settings/tax` screen shows an explicit
  warning and never enables live filing for OSCU.
- **Resolution:** accepted for this build; revisit only if a customer segment
  requires OSCU, which would be an architecture decision, not a config change.

### F-19 — Standard VAT only; no regime/rate distinction
- **Where:** `modules/tax/tax-calculator.ts` (`KENYA_STANDARD_VAT_RATE`)
  and `InvoiceTaxService.resolveRate()`.
- **Impact:** any org with a `TaxRegistration` row is charged 16% VAT on every
  invoice, treated as **tax-inclusive** (the line `total` is the gross the
  customer pays; net/tax are extracted from it, so existing "amount due"
  logic is unchanged). There is no zero-rated/exempt item support and no
  Turnover Tax / simplified-regime branching.
- **Why:** Section 7 item 3 explicitly defaults those out of Phase B. Also, a
  business with a KRA PIN is not necessarily VAT-registered, so "has a
  `TaxRegistration`" is a deliberate, documented proxy for "tax-registered".
- **Resolution:** revisit with real customer data (how many fall under a
  different regime / are not VAT-registered); would change the rate source,
  not the choke point.

### F-20 — `FeeInvoice` is outside the tax choke point
- **Where:** `modules/school-fees/school-fees.service.ts` creates `FeeInvoice`
  (a separate model, Section 4 only lists `Invoice`), which does not go through
  `InvoiceTaxService`.
- **Impact:** school fee invoices calculate no tax. The "architecturally
  impossible to skip tax" guarantee currently covers the `Invoice` model only.
- **Resolution:** decide whether fee invoices are taxable (education services
  are frequently VAT-exempt in Kenya) and, if so, extend the choke point to
  `FeeInvoice` — a deliberate decision, not a silent gap.

### F-21 — Live VSCU/KRA contract unverified
- **Where:** `modules/tax/vscu/vscu.client.ts` (`sign` → local
  `POST /trnsSales/saveSales`; `transmit` → KRA API).
- **Impact:** the endpoint paths and the sign response fields (`rcptNo`,
  `intrlData`, `rcptSign`) are taken from KRA's current VSCU spec, but the live
  transmit request shape, authentication (device communication key from
  initialization), and error codes have not been exercised — this environment
  has no VSCU JAR or KRA sandbox credentials (same class as F-02).
- **Mitigation in the build:** the failure *classification* (no response =
  offline; any response with an error = KRA error) and the whole queue/retry
  state machine are unit-tested with a mocked client, so only the thin HTTP
  adapter is unverified.
- **Resolution:** exercise `ETIMS_VSCU_BASE_URL` + a real test VSCU and set
  `ETIMS_API_KEY`; confirm the transmit contract against current KRA docs.

### F-22 — Branch id hardcoded to head office for signing
- **Where:** `VscuClient` / `TaxSyncService.buildSignInput` use
  `ETIMS_BRANCH_ID` (default `"00"`, head office).
- **Impact:** a multi-location org signs all invoices against the head-office
  branch code; KRA branch-level reporting would be wrong until per-branch
  signing exists.
- **Update (2026-09-30):** Phase F (multi-branch aggregation) landed but did
  **not** add per-branch signing, because there is still no branch/location
  model to source the id from (see F-26). Still Open, blocked on the same
  location model; the fix is to carry a branch id through to
  `TaxInvoiceRecord` and the signing payload once that exists.

### F-23 — Credit notes / voided invoices not represented
- **Where:** `TaxReportService` filters `invoice.status != VOIDED`; there is no
  credit-note model or eTIMS credit-note call.
- **Impact:** a voided or credited sale is omitted from the tab's filed totals
  rather than shown as a reversal. KRA requires a credit note to be raised from
  the same solution that issued the original invoice.
- **Why:** full credit-note handling is explicitly out of scope (Section 6 —
  this is not a complete accounting suite).
- **Resolution:** add credit-note handling when the business needs it; it
  extends T-B/T-C (a new record type + signing path), not just the tab.

### F-24 — Reconciliation job only covers the open filing window
- **Where:** `TaxReconciliationService.runForOrganization()` / `flagAnomalies()`.
- **Resolved (2026-09-30):** the run now reconciles the open window (current +
  previous month) **plus any period that still has an unresolved
  `TAX_RECONCILIATION_MISMATCH` alert** (derived from the alert's invoice), so an
  old mismatch keeps being re-flagged rather than going quiet. Alert resolution
  is also scoped: an alert is only cleared once its invoice has actually been
  re-checked this run, so a run that does not examine a period can never
  silently resolve its alerts. Backed by `monthPeriod()` and
  `invoiceIdFromAnomalyKey()`; the tests cover the carry-forward and the
  "do not clear an unexamined period" cases.

### F-25 — Multi-branch tax tier: doc wording vs the reused gate
- **Where:** `TaxAggregationController` / `TaxAggregationService` reuse the
  existing `TierFeature.MultiLocation` (GROWTH).
- **Resolved (2026-09-30):** the docs were reconciled to the code and to the
  instruction to reuse the existing multi-location concept. `hisaflow-tax-system.md`
  Phase F and `hisaflow-agent-build-briefs.md` Layer T-F are now headed
  "Growth multi-location depth", and the paywall §1A Tax row no longer lists
  "multi-branch aggregated filing view" under Team — a callout under the matrix
  states it is Growth (reusing the same capability as the ISP second router /
  guest-house properties).

### F-26 — Guest-house "multi-property" is not modelled
- **Where:** `TaxAggregationService` derives a location from
  `Invoice.subscriber.router.label`, else `Main location`.
- **Status: Accepted risk (2026-09-30).** This is not a defect in Phase F — the
  underlying multi-property feature is explicitly out of scope in
  `hisaflow-guesthouse-scope.md`, so there is no second property to group by.
  The aggregation is deliberately generic: when a first-class location/property
  model does land, carrying its id/label onto the invoice makes this view pick
  it up with no tax-specific change. ISP orgs with multiple `Router` POPs (the
  paywall §1 example) already aggregate correctly.




---

## 3. Vertical Value Checklist audit — 2026-11-03

The full question-by-question audit lives in `HisaFlow Vertical Value Checklist.md` §12; after the 6 November pass it is 123 questions: 46 code-verified, 48 partly, 27 no, 2 unknown. The findings below are the blockers/high-severity gaps that need a build or messaging decision. They do not repeat F-05/F-13 (trial mismatch), F-20 (school fee tax) or F-02 (live Paystack verification), which remain open.

### F-27 — Landing-page M-Pesa matching claim is not backed by the product
- **Where:** `apps/frontend/features/marketing/config/content.ts`.
- **Impact:** the original copy described owner-customer payment reconciliation. The repo only integrates Paystack for HisaFlow's own subscription billing. No M-Pesa statement/API ingestion exists for a shop's customer payments.
- **Resolved (2026-11-03):** copy changed to "Record M-Pesa in one place", "One daily total for every payment", "VAT kept with the invoice" and "Card payments, recorded". The reconciliation feature is still unbuilt; it is simply no longer claimed. Restore the stronger claim only after the feature ships.

### F-28 — Stock corrections bypass the append-only ledger
- **Where:** `EditItemSheet` → `PATCH /inventory/variants/:variantId` → `InventoryService.updateVariant()`.
- **Impact:** quantity is overwritten directly; no `InventoryTransaction` is written. The stock count can silently diverge from the audit trail, violating the "append-only ledger" rule and DK8.
- **Resolved (2026-11-06):** `InventoryService.updateVariant()` now builds the quantity projection and writes an `ADJUSTMENT` `InventoryTransaction` (before/change/after + actor) in one `$transaction`. Metadata-only edits stay projection-only. `inventory.service.spec.ts` covers both paths. A dedicated counted-vs-system stock-count screen is still deferred (DK8 remains partly).

### F-29 — Dead relative `/api/...` vertical screens
- **Where:** `app/(dashboard)/table-orders/page.tsx`, `components/restaurant/OpenTableSheet.tsx`, `components/restaurant/TableOrdersView.tsx`, `components/chemist/ReceiveBatchSheet.tsx`, `components/wholesale/TieredPricingSheet.tsx`, `app/(dashboard)/students/[id]/page.tsx`.
- **Impact:** these call `fetch('/api/...')` on the Next origin, but the backend is a separate Nest application and there are no Next route handlers or rewrites. The screens 404/fail. `ReceiveBatchSheet` and `TieredPricingSheet` are also not imported anywhere.
- **Resolved (2026-11-06):** all seven relative fetches were replaced with typed services over `apiGet/apiPost`: table-order page/open/view, add-table-item, batch receipt, tiered pricing and student detail. `ReceiveBatchSheet` and `TieredPricingSheet` are now imported from Edit Variant for CHEMIST/WHOLESALER. The tiered-pricing body was corrected to the array the controller expects. No `fetch('/api...')` call remains in the frontend.

### F-30 — School fee UI is placeholders; student detail is unreachable
- **Where:** `app/(dashboard)/school-fees/page.tsx` (invoices/defaulters/summary tabs), `app/(dashboard)/students/[id]/page.tsx`, `components/school/RecordPaymentSheet.tsx`.
- **Impact:** backend endpoints (`/school-fees/term/:termId/defaulters`, `/summary`, `/fees`) exist, but the owner sees static text; the student detail page that hosts the payment sheet calls the broken `/api/students/:id`.
- **Resolved (2026-11-06):** `school-fees/page.tsx` now loads invoices, defaulters and term summary from the existing endpoints and can issue DRAFT invoices; `students/[id]` uses `apiGet('/students/:id')` and shows issued invoices with payment entry. `RecordPaymentSheet` refreshes through SWR instead of a full page reload.

### F-31 — No owner data export
- **Where:** only `admin/directory` and `admin/audit` expose CSV export.
- **Impact:** the owner cannot export their own inventory, sales, invoices, fee records or tax data; this undermines the "never feel trapped" promise and C27.
- **Resolved (2026-11-06):** new `DataExportModule` exposes `GET /exports/:dataset` for inventory, transactions, invoices, fee-invoices, credit and tax, scoped to the caller's organisation and restricted to OWNER/MANAGER. Settings → Your data downloads each CSV with the Clerk token. Covered by `data-export.service.spec.ts` and `lib/data-export.spec.ts`.

### F-32 — ISP invoices do not generate on a billing cycle
- **Where:** `IspInvoicesService.generateForSubscriber()` is manual; no cron for invoice generation. `BillingSuspendJob` only suspends overdue invoices.
- **Impact:** "invoices generate on each subscriber's billing cycle" is false; the owner must press Generate Bill per subscriber.
- **Resolved (2026-11-06):** new `IspBillingCycleJob` runs daily at 06:00, anchors each subscriber's current period to their signup date for MONTHLY/QUARTERLY/ANNUALLY, generates an invoice and issues it, and skips a period that already has a non-voided invoice. `billing-cycle.job.spec.ts` covers the cycle maths, generation and idempotency. Due date defaults to seven days after cycle start.

### F-33 — Retail payments, day close and receipts are missing
- **Where:** `CreateTransactionDto` has no payment method; `QuickTransactionSheet` records only item + quantity; no shift/day-close model; only guest-house invoices have a receipt/print.
- **Impact:** C13, MM3, MM7, DK9 cannot be answered Yes; cash/M-Pesa/card totals cannot be reconciled at close.
- **Resolution:** add `paymentMethod` to retail sales, a close-of-day/shift report, and a retail receipt (print/share link).

### F-34 — Restaurant workflow is largely not reachable
- **Where:** `RecipeIngredient`/`isComposite` exist, but `AddItemSheet` has no recipe editor; table order UI uses F-29's broken `/api`; `TableOrderStatus` has no kitchen/prepared state; no split payments or dish-margin report.
- **Impact:** RS1, RS3–RS5, RS9, RS10 have no owner path; `closeOrder` deducts stock without ledger rows.
- **Resolution:** build the recipe builder, add preparation state and split payments, and add dish margin/variance reporting.
- **Progress (2026-11-06):** table orders now use the Nest API, support adding items, and `closeOrder()` aggregates deductions, blocks negative stock and writes `SALE` ledger rows. Recipe editor, kitchen state, split payment and margin/variance remain open.

### F-35 — Chemist safety and batch workflow gaps
- **Where:** `InventoryItem.unit` is free text; `TransactionsService` FIFO can deduct an expired batch; `StockBatchesService.retire()` zeroes a batch without an item/ledger adjustment; `ReceiveBatchSheet` is now wired, but the other gaps remain.
- **Impact:** CH1, CH5, CH6, CH9 and CH11 are not met; the first expiry alert can exist but the owner cannot safely act on it end-to-end.
- **Resolution:** add proper units, an expired-sale guard with override, a batch-specific write-off (with cost), and money-at-risk reporting.
- **Progress (2026-11-06):** `ReceiveBatchSheet` is now reachable from Edit Variant for chemists and posts through `/stock-batches`. The remaining safety gaps are unchanged.

### F-36 — Guest-house consumption and invoice immutability
- **Where:** `BookingsService.addConsumption()` writes a SALE ledger row but does not price it into the invoice; `InvoicesService.addLineItem()` still allows changes after `ISSUED`; `InvoiceView` reads current booking/guest data.
- **Impact:** GH5/GH6/GH11 are only partly met: the bar tab requires a separate manual charge, and a later guest edit changes how a past invoice reads.
- **Resolution:** price consumption into the folio at the point of sale and snapshot guest/business/line totals on issue; freeze issued invoices.

### F-37 — Real-device and live-hardware verification remains pending
- **Where:** PWA/camera flows, router suspend/reconnect, M-Pesa renewal and KRA filing are covered by code and mocked tests, but not by field evidence in this repo.
- **Impact:** C5/C6/ISP7/ISP13 and the live tax/payment claims cannot be marked Yes under the checklist's original definition until an owner/device test is recorded.
- **Resolution:** run the Section 11 sessions with a real owner per vertical, including a real MikroTik cut/restore and an installed-iOS camera capture.

### F-38 — ISP plan cycle values did not match the database enum
- **Where:** `apps/frontend/app/(dashboard)/service-plans/page.tsx`, `apps/frontend/services/isp.service.ts`, `apps/backend/prisma/schema.prisma`.
- **Impact:** the UI offered `DAILY`, `WEEKLY` and `ANNUAL`, but `BillingCycle` only defines `MONTHLY`, `QUARTERLY` and `ANNUALLY`. Creating a plan with an offered value could fail validation or produce a type mismatch.
- **Resolved (2026-11-06):** the frontend type, labels and select options now use the three real enum values. The billing-cycle job therefore handles every cycle a plan can actually store.

### F-39 — Production router encryption key was missing
- **Where:** Northflank service `hisaflow` (project `default`), runtime logs for `ReconciliationJob`.
- **Evidence (2026-11-06):** `ReconciliationJob: could not connect to router Main POP Gateway (192.168.88.1) — ROUTER_ENCRYPTION_KEY env var is not set`.
- **Impact:** router API passwords are stored AES-256-CBC encrypted, but without the key the backend cannot decrypt them. Suspend/reconnect and drift reconciliation therefore could not work in production.
- **Resolved (2026-11-10):** `ROUTER_ENCRYPTION_KEY` was added to the API service runtime environment and the service was restarted. The 11:15 reconciliation cycle logged `Timeout` instead of `ROUTER_ENCRYPTION_KEY env var is not set`, confirming the key is loaded and decryption runs. The next proof is the Phase 6 MikroTik cut/restore test with a reachable router; the configured `192.168.88.1` is a private address, so ISP7/ISP13 remain field-unverified.

### F-40 — Official LiteLLM proxy could not fit the free Northflank allowance
- **Where:** Northflank project `default`, service `hisaflow-gateway`.
- **Evidence (2026-11-10):** the official `main-stable` proxy was OOM-killed (exit 9) at `nf-compute-20` (512 MB) after startup, with full and one-model configs. A 1 GB plan (`nf-compute-50`) was rejected: “Deployment plan nf-compute-50 exceeds your free project deployment resource allowance”. The project allowance is 1 GB total and the API service already uses 512 MB.
- **Resolved (2026-11-13):** the gateway moved to Cloud Run `hisaflow-litellm` in `hisaflow` / `europe-west1` with 1 vCPU, 2 GiB, min 0 / max 2 and request-based billing. It runs the official `litellm` proxy command against the existing image and `config.yaml`. The Northflank `hisaflow-gateway` service was deleted; Northflank now has only the `hisaflow` API service.

### F-41 — Gateway Gemini key was invalid
- **Where:** `apps/gateway/.env` → Northflank `hisaflow-gateway` runtime environment.
- **Impact:** the standard and vision pools fell over to Gemini and returned an authentication error; streaming requests closed without a completion. Groq and OpenRouter were valid (`200`).
- **Resolved (2026-11-10):** the valid Gemini key from `apps/backend/.env` was copied into the gateway environment. `hisaflow-standard`, `hisaflow-assistant`, `hisaflow-vision` and a streaming completion all returned `200`. Re-check all provider keys after rotation.

### F-42 — Backend pointed at a dead Railway gateway
- **Where:** Northflank `hisaflow` runtime environment.
- **Evidence (2026-11-10):** `LITELLM_BASE_URL=https://hisaflow-production.up.railway.app/v1` returned `404 Application not found`.
- **Resolved (2026-11-13):** the backend now uses `https://hisaflow-litellm-cgqiivalxa-ew.a.run.app/v1`; the `LITELLM_MASTER_KEY` is the same 32-byte random secret used by Cloud Run. The API service was restarted and its root health endpoint returns `200`.

### F-43 — Cloud Run MCP redeploy does not preserve the service spec
- **Where:** `cloud-run` MCP, `deploy_container_image` tool.
- **Impact:** the tool accepts only `project`, `region`, `service` and `imageUrl`. It does not set or preserve `command`, `args`, runtime env, 2 GiB memory, min 0 / max 2 or CPU throttling. A naive redeploy would reset the service and could take the backend offline.
- **Resolution:** redeploy through the Cloud Run Admin API with the full service spec (as done on 2026-11-13), or use a checked-in deploy script that reads the provider keys from the environment. Do not use the MCP image-only deploy for production updates.

### F-44 — Assistant could not report sales, advise on the catalogue or write natural replies
- **Where:** `apps/backend/src/modules/assistant/tools/assistant-tools.service.ts`, `agent/assistant-agent.service.ts`, `apps/frontend/components/assistant/AssistantMessageText.tsx`, `apps/frontend/lib/assistant.ts`.
- **Evidence (2026-11-13):** sales questions produced “I cannot report sales” or an estimate because no sales read tool existed. The assistant could not analyse catalogue health, suggest new items, list notes/tax/team activity, or answer “who owes me?”, “what did I spend?” and “what needs attention?” from data. Replies containing model Markdown, backticks or fenced JSON appeared as raw code in the chat bubble.
- **Resolved (2026-11-13):** added the shared read tools `get_sales_report` (period totals, margin, credit, top/by-category items and a previous-period comparison), `analyse_catalogue` (fast/slow movers, low stock, margin risks, packaging/category gaps and labelled new-item suggestions), `get_credit_summary`, `get_expense_report`, `get_active_alerts`, `get_purchase_report`, `get_recent_transactions`, `list_notes`, `get_tax_summary`, `list_team_members`, plus the proposal-only `resolve_alert`. The prompt routes questions to these tools and adds advisory/safety guidance. Additional writes fill common intents: `record_expense`/`record_income` (business ledger), `adjust_stock` (counted correction with an ADJUSTMENT ledger row), `archive_inventory_item` (soft delete) and `record_credit_payment` (now available to every business type, not only wholesalers). The UI renders bold and lists as prose, turns JSON fences into labelled values, turns tables into bullets and strips code/backtick formatting. Guards: `assistant-reporting-tools.service.spec.ts`, `assistant.module.spec.ts`, `assistant-agent.service.spec.ts`, `lib/assistant.spec.ts`, `AssistantMessageText.spec.tsx`.
- **Live evaluation (2026-11-13):** `apps/backend/scripts/assistant-characterization.mjs` passed 22/22 cases on the primary `hisaflow-assistant` model (`openai/gpt-oss-120b`) across English/Swahili sales, catalogue, advice and write prompts, and 6/6 smoke cases through the production Cloud Run gateway. The C16 ambiguity case passed (two sugar matches → clarification question, no sale). Results: `context/assistant-characterization-2026-11-13.md`.
- **Eval-found defect fixed:** Groq rejected a generated tool call containing `days: null` for an optional numeric argument. `ToolRegistryService.toSchemas()` now makes non-required primitive arguments explicitly nullable, and `asLimit`/period-handling treat `null` as absent. Guards: `tool-registry.service.spec.ts`, `assistant-reporting-tools.service.spec.ts`.
- **Remaining:** no production owner-device session has been recorded for the new reporting/advice tools yet.
