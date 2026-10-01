# HisaFlow — Tax System: Design & Implementation Guide

**Status:** Ready for review, pending open decisions in Section 7
**Depends on:** Existing `Invoice`/`InventoryTransaction` models, KRA eTIMS taxpayer registration
**Purpose:** Tax compliance as an invisible byproduct of every sale, not a page the user works in. This doc scopes the architecture and the phased build — see `hisaflow-paywall.md` Section 1A for how this feature sits in the Solo/Team tiering (it's floor, not upsell).

---

## 1. The core design principle

The tax tab is a **reporting surface for work already done automatically** — not a workspace where the user enters or reconciles anything by hand. Every sale that flows through HisaFlow's existing invoicing already has everything needed to calculate, sign, and file its tax component; the system's job is to do that at the moment of the transaction, not to make the user visit a separate tab afterward and do it themselves. Building a "tax tab" that requires manual entry would be building the wrong thing, even if it technically exists.

---

## 2. KRA eTIMS — the mechanism, fact-checked

KRA's eTIMS (electronic Tax Invoice Management System) offers **two integration modes**, and the choice between them is architecturally significant, not a minor config toggle:

- **OSCU (Online Sales Control Unit)** — hosted at KRA. The business's system calls KRA's API in real time to validate, sign, and transmit each invoice as it happens. **Requires being online at the point of sale.**
- **VSCU (Virtual Sales Control Unit)** — hosted client-side. Invoices are signed locally by software running with the business, then synced/transmitted to KRA afterward, in batches or as connectivity allows.

**HisaFlow should build on VSCU, not OSCU.** This is a direct consequence of the offline-first requirement already identified as one of the two things (alongside eTIMS itself) that decide whether a Kenyan POS tool is actually viable, per the Veira research. A duka owner in an area with unreliable power or network needs the sale to complete and the tax invoice to sign *locally*, then sync when connectivity returns — OSCU can't do that, VSCU can.

**Onboarding requirement (fact-checked, needed before any integration work starts):** a business registers on the KRA eTIMS Taxpayer Sandbox using its KRA PIN, submits a Commitment Form, and selects its device/integration type (OSCU or VSCU) as part of that registration. This is a per-organization registration step, not a one-time thing HisaFlow does once for the whole platform — each HisaFlow customer organization that wants eTIMS filing needs its own KRA registration completed, which has real implications for onboarding UX (Section 5).

**Verified 2026-09-30 (Phase C build):** the OSCU/VSCU distinction and the offline-signing claim both hold against KRA's current *VSCU Specification Document v2.0* and the *eTIMS System-to-System Integration* page. VSCU is a JAR deployed on the taxpayer's **local** server, described by KRA as "a bridge system between KRA eTIMS systems and private TIS/ERP"; `POST /trnsSales/saveSales` returns the locally-issued `rcptNo` (receipt number), `intrlData` (internal data) and `rcptSign` (receipt signature); and KRA states that *"if there is no internet connection for 24 hours after VSCU issues a receipt signature and an internal data, VSCU stops issuing a receipt number"* — i.e. signing works **offline** for up to 24 hours. Phase C therefore treats local signing as offline-capable and owns the transmission queue/retry itself rather than leaving the offline window unmanaged.

---

## 3. How tax threads through the existing system

No new, parallel "tax entry" flow — tax is calculated and attached at the point an `Invoice` is created from the existing sales/checkout flow:

1. A sale completes through the existing invoicing flow (already built, per the core HisaFlow product).
2. At that moment, tax is calculated per line item automatically — not entered by the user.
3. The invoice is signed locally via the VSCU integration (works even if the device is offline at that instant).
4. The signed invoice is queued for transmission to KRA; transmission happens immediately if online, or on reconnect if not.
5. The Tax tab surfaces what's already true: filed invoices, pending-sync invoices, and the period's tax summary — a status display, not a data-entry surface.

---

## 4. Data model additions

| Entity | Purpose |
|---|---|
| `TaxRegistration` | Per-organization: KRA PIN, eTIMS registration status, device/integration type (VSCU), sandbox vs. production mode. |
| `TaxInvoiceRecord` | One row per `Invoice` requiring tax filing: calculated tax amount, VSCU signature/reference, sync status (`PENDING` / `SYNCED` / `FAILED`), KRA-assigned invoice reference once transmitted. |
| `TaxSyncQueue` | The offline-resilience mechanism — invoices signed locally while offline sit here until connectivity returns, then transmit in order. This is what actually makes the offline promise in Section 2 real, not just an architecture diagram claim. |

**Naming discipline, consistent with the rest of the codebase:** don't let `TaxInvoiceRecord` collide conceptually with the existing `Invoice` model — it's a tax-specific companion record referencing an `Invoice`, the same relationship pattern already used for `PaymentAttempt` referencing a `Subscription`'s billing cycle.

---

## 5. Execution phases

### Phase A — Organization Tax Registration
**Data model:** `TaxRegistration`.
**API:** Endpoint(s) to capture an org's KRA PIN and initiate/track eTIMS sandbox registration status.
**Frontend:** A settings screen where an org owner enters their KRA PIN and sees registration status — this can't be fully automated (the Commitment Form step is a KRA-side process HisaFlow doesn't control), so the UI needs to honestly represent "registration pending with KRA" as a real state, not hide it.

**Done when:** An org can register their KRA PIN, and HisaFlow correctly reflects whether eTIMS registration (sandbox first, then production) is complete before attempting any live filing for that org.

### Phase B — Automatic Per-Sale Tax Calculation
**Data model:** Extend `Invoice`/line-item structure to carry calculated tax per item (if not already present).
**API:** Tax calculation logic hooked into the existing invoice-creation flow — this must run automatically on every sale for a tax-registered org, not be a separate action the user triggers.

**Done when:** Every invoice created for a tax-registered org has a correctly calculated tax amount with zero manual entry, verified against known tax rate scenarios.

### Phase C — VSCU Signing & Offline Queue
**Data model:** `TaxInvoiceRecord`, `TaxSyncQueue`.
**API:** VSCU integration for local invoice signing; queue logic for offline-signed invoices; background sync job that transmits queued invoices to KRA on reconnect, in order, with retry on transmission failure (same audit-and-retry discipline already established for `RouterAction` in the ISP vertical and `PaymentAttempt` in billing — a consistent pattern across the codebase, not a fourth different retry mechanism).

**Done when:** A sale completed while the device is offline signs successfully, queues correctly, and transmits to KRA automatically once connectivity returns — with a visible sync-status indicator so a user isn't left wondering whether an offline sale was actually filed.

### Phase D — Tax Tab: Status & Summary
**Frontend:** The actual Tax tab — read-only display of filed/pending invoices, current period's tax summary ("what's owed this period," computed from already-filed data, not entered).

**Done when:** Opening the Tax tab shows an accurate, real-time picture of filing status with no action required from the user to make the numbers correct — the tab reflects reality, it doesn't construct it.

### Phase E — Reconciliation & Anomaly Detection *(Team-tier depth, per the floor/depth split)*
**API:** Scheduled job comparing filed invoices against expected sales activity, flagging mismatches (a sale that never synced, a filing that doesn't match collected tax) before a filing deadline rather than after.
**Frontend:** Reconciliation dashboard, anomaly alerts.

**Done when:** A deliberately introduced mismatch (e.g. a manually blocked sync) is surfaced as a flagged anomaly before the relevant filing period closes.

### Phase F — Multi-Branch Aggregation *(Growth multi-location depth)*
**API/Frontend:** Aggregated tax view across an org's multiple locations (ties naturally to the Growth-tier multi-location capability already scoped for the ISP vertical's multi-`Router` design and the guest-house multi-property case).

**Done when:** An org with more than one registered location sees a correctly aggregated tax summary across all of them, not one per location requiring manual addition.

---

## 6. Explicitly out of scope for this build

- OSCU support — VSCU is the deliberate choice per Section 2; revisit only if a specific customer segment's needs change this calculus.
- Turnover Tax or other alternative small-business tax regimes beyond standard VAT filing — confirm with the business side whether HisaFlow's target customers (many of whom are small enough to potentially qualify for simplified regimes) need this distinction supported; flagged as Open Question 3 below rather than assumed.
- Automated e-filing of anything beyond the transactional invoice stream (e.g. full annual return preparation) — this system automates the invoice-level compliance eTIMS requires, not a full accounting/tax-filing suite.

---

## 7. Decisions — defaulted to industry standard, revisit if needed

1. **Onboarding friction:** cannot be fully automated (KRA's Commitment Form step is outside HisaFlow's control) — default is honest status display in the UI ("Registered," "Pending KRA approval," "Active") rather than implying instant activation. Already the direction Phase A was scoped in; confirmed as final for now.
2. **NOT defaulted — factual, not policy:** the exact sandbox-to-production transition process must be confirmed directly against KRA's current eTIMS documentation at the start of Phase A build — this determines real status states and timing, not something to assume from this doc.
   - **Verified 2026-09-30 (Layer T-A)** against KRA's current eTIMS documentation: the "eTIMS System to System Integration" page, the *eTIMS OSCU and VSCU Integration Step-by-Step Guide* (v1.1, April 2023), the *VSCU Specification Document* (v2.0), and the *TIS for OSCU/VSCU Technical Specifications* (v2.0). Findings that shape Phase A:
     - **Sandbox and production are separate hosts.** Sandbox portal `etims-sbx.kra.go.ke`, sandbox API `etims-api-sbx.kra.go.ke`; production portal `etims.kra.go.ke`, production API `etims-api.kra.go.ke`. VSCU itself ships as either a **Test** (sandbox) or **Production** build, switched by `api.external.domain`.
     - **Onboarding is a KRA-side process.** The taxpayer signs up with their KRA PIN (OTP to the registered phone), raises a **Service Request** (selecting VSCU/OSCU), and uploads the **eTIMS Commitment Form**. KRA then processes it and confirms by SMS: *"Service Request was approved. You can now proceed with eTIMS installation in your KRA Account."* **Approval is not instant.**
     - **Production is a further KRA step**, not a toggle: KRA's system-to-system path is *development → testing → vetting → certification* (self-integration or a KRA-verified 3rd-party integrator). Device initialization (PIN + branch ID + equipment serial) only runs after the eTIMS type is registered and approved.
     - **Consequence (reflected in the build):** the status model must include explicit pending states, `PRODUCTION_ACTIVE` is the only state that may enable live filing, and the UI must never imply instant activation (per item 1). Phase A does not integrate with KRA, so statuses beyond PIN capture are recorded from what KRA reports, not auto-derived.
3. **Turnover Tax / simplified regimes:** defaulted to **out of scope for Phase B** — build standard VAT/eTIMS invoicing as the baseline (matching the target customer profile competitors like Veira also serve), and treat simplified-regime support as a v2 candidate rather than blocking Phase B on an unconfirmed need. Revisit once real customer data shows how many orgs actually fall under a different regime.
4. **KRA outage vs. device-offline distinction:** defaulted to the same retry-with-backoff pattern already established for `RouterAction` (ISP vertical) and `PaymentAttempt` (billing) — consistent across the codebase rather than a fourth pattern. Distinguish the two failure modes by response type: no network response at all → offline queue path (Phase C); an actual error response from KRA's API (5xx, timeout with response) → a separate backoff-and-alert path, since a prolonged KRA-side outage affecting many orgs at once is a different problem than one device being offline and should be visible to the team, not silently queued forever.

---

## 8. Progress tracker

| Phase | Layer | Status | Notes |
|---|---|---|---|
| Open Questions 1–4 | Decision | ☑ Done (defaulted) | See Section 7 — industry-standard defaults applied; #2 remains a build-time factual check |
| A. Org Tax Registration | Data model | ☑ Done (2026-09-30) | `TaxRegistration` added to `apps/backend/prisma/schema.prisma` (`EtimsIntegrationType`, `EtimsRegistrationStatus`, `EtimsEnvironment`), org-scoped and distinct from `Invoice`. Valid via `prisma validate`/`generate`. |
| A. Org Tax Registration | API | ☑ Done (2026-09-30) | `apps/backend/src/modules/tax` — `GET /tax/registration`, `PUT /tax/registration`, `POST /tax/registration/submit`, `POST /tax/registration/kra-outcome`. Status never auto-advances; `canFileLive` is true only for `PRODUCTION_ACTIVE`; org-reportable outcomes are allow-listed. 11 tests (95 backend total). KRA sandbox→production process verified against current KRA docs (Section 7 item 2). |
| A. Org Tax Registration | Frontend | ☑ Done (2026-09-30) | `/settings/tax` (linked from Settings): owner enters KRA PIN + integration type, acknowledges the Commitment Form and marks submitted, records KRA outcomes, sees a milestone timeline and an always-visible "How eTIMS registration works" explainer that states pending KRA approval is normal and KRA-side. A failed status fetch shows an explicit "couldn't load" state rather than implying "not registered"; pending states are labelled "Live filing off"; nothing implies instant activation. Pure status + control-visibility helpers in `lib/tax.ts` with 9 node:test cases (22 frontend tests total). |
| B. Automatic Tax Calculation | Data model | ☑ Done (2026-09-30) | `Invoice.taxTotal` + `InvoiceLineItem.netAmount`/`taxAmount`/`taxRate` added (additive, default 0) to `apps/backend/prisma/schema.prisma`. `total` keeps its tax-inclusive "amount due" meaning. Valid via `prisma validate`/`generate`. |
| B. Automatic Tax Calculation | API | ☑ Done (2026-09-30) | `tax-calculator.ts` (standard 16% VAT, inclusive extraction) + `InvoiceTaxService` — the single choke point that creates every `Invoice`/`InvoiceLineItem` and calculates tax automatically for a tax-registered org. `InvoicesService`, `IspInvoicesService`, `EquipmentService` refactored to use it; a static guard test fails if a raw `invoice.create`/`invoiceLineItem.create` reappears. No manual entry, no regime branching (Section 7 item 3). 14 new tests (109 backend total). |
| C. VSCU Signing & Offline Queue | Data model | ☑ Done (2026-09-30) | `TaxInvoiceRecord` + `TaxSyncQueue` (plus `TaxInvoiceStatus`, `TaxSyncStatus`, `TaxSyncErrorClass`, and `AlertType.TAX_SYNC_FAILED`) added to `prisma/schema.prisma`; additive. `TaxInvoiceRecord` holds the calculated split + VSCU-local signature + KRA reference; `TaxSyncQueue` is the ordered offline queue. |
| C. VSCU Signing & Offline Queue | API | ☑ Done (2026-09-30) | `VscuClient` (local `POST /trnsSales/saveSales` signing; KRA transmit with `VscuConnectionError` vs `VscuApiError`), `TaxFilingService` (record/queue at the Phase B choke point), `TaxSyncService` + 5-minute `TaxSyncJob` (in-order, per-org halt, offline = silent backoff, KRA error = longer backoff + `TAX_SYNC_FAILED` alert), and `GET /tax/sync-status`. 14 new tests (123 backend total), incl. the offline-sale→reconnect scenario. KRA VSCU offline signing re-verified against current KRA docs. |
| D. Tax Tab (Status & Summary) | Frontend | ☑ Done (2026-09-30) | `/tax` (added to the side nav): strictly read-only period view — registration state, VAT filed vs awaiting, needs-attention count, and the period's invoices with KRA refs. Backed by a new read-only `GET /tax/report` (T-C's status endpoint had sync state but no amounts); a month navigator is the only interaction. No form/input/mutation by design — `lib/tax-report.test.ts` fails if one is added. 5 new frontend tests (27 total). Voided/credit-note handling open in F-23. |
| E. Reconciliation & Anomaly Detection | API | ☑ Done (2026-09-30) | Team-tier depth. `TaxReconciliationService` + daily `TaxReconciliationJob` (`EVERY_DAY_AT_6AM`) + `GET /tax/reconciliation`, gated by `@RequiresFeatures(TaxReconciliation)` **and** a service assert; the job silently skips non-entitled orgs via a new `EntitlementsService.hasFeature`. Pure `detectTaxAnomalies` flags `SALE_NOT_FILED` / `SALE_NOT_SYNCED` / `FILED_AMOUNT_MISMATCH` / `FILED_FOR_NON_SALE`; deduped `TAX_RECONCILIATION_MISMATCH` alerts + critical push. VAT deadline = 20th of the following month. Gating is **locked by `tax-reconciliation.controller.spec.ts`**. **Patch (2026-09-30): F-24 resolved** — the run now carry-forwards any period with an open anomaly and only resolves an alert once its invoice was re-checked (no silent clears). 20 new tests (158 backend total). |
| E. Reconciliation & Anomaly Detection | Frontend | ☑ Done (2026-09-30) | `/tax/reconciliation` (linked from the Tax tab): Team badge, month navigator, filing-deadline countdown, checked-sales/critical/warning tiles, and the anomaly list. Anomaly alerts also render in the app-wide Alerts tab (`AlertItemCard` now labels `TAX_RECONCILIATION_MISMATCH` → "Tax Reconciliation" and `TAX_SYNC_FAILED` → "Tax Filing"). Solo gets the server-side 403 → paywall redirect (`?feature=reconciliation`). Read-only — `lib/tax-reconciliation.test.ts` fails if a data-entry path is added. 4 new tests (31 frontend total). Job window noted in F-24. |
| F. Multi-Branch Aggregation | API + Frontend | ☑ Done (2026-09-30) | `/tax/aggregate` + `GET /tax/aggregate`: per-location filed/awaiting VAT rolled into one grand total, with a shared period/deadline. Reuses the existing `TierFeature.MultiLocation` (Growth) gate — the same one the 2nd ISP router uses — instead of a tax-specific concept; locations come from the existing ISP `Router` (POP) via `Invoice.subscriber.router`, with a "Main location" fallback. Read-only; `lib/tax-aggregation.test.ts` derives the total from the rows and fails on a data-entry path. 10 backend + 4 frontend tests. **Patch (2026-09-30): F-25 resolved** — Phase F/T-F headings and paywall §1A reconciled to Growth multi-location. **F-26 accepted** (guest-house multi-property is out of scope); F-22 (per-branch signing) remains blocked on a location model. |

**How to update:** same convention as every other HisaFlow doc — `In progress` when work starts, `Done` once merged with a note. Don't start Phase A until Section 7's open questions are answered.

---

## 9. Guidance for the agent picking this up

- Build Phase B (automatic calculation) as something that runs inside the existing invoice-creation path, not as a feature the user has to remember to invoke — if a code review finds a path where an invoice can be created without tax being calculated for a tax-registered org, that's a bug, not an edge case.
- Phase C's offline queue is the phase most likely to get simplified under time pressure ("we'll just require being online for now") — don't. The offline requirement is precisely what differentiates a genuinely usable Kenyan POS from one that fails exactly when the business needs it most (per the Veira research this doc is grounded in).
- Keep Phase D's Tax tab strictly read-only/status-only. The moment it grows an "edit" or "manual entry" action for a filed invoice, the core design principle in Section 1 has been broken.
- Confirm Section 2's OSCU/VSCU distinction and the sandbox registration process against KRA's current eTIMS documentation directly before Phase A begins — tax-authority integration details are exactly the kind of thing worth re-verifying at build time rather than trusting a doc indefinitely.
