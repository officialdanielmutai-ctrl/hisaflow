# HisaFlow — Scanning & Barcode Upgrade

**Directive:** continuation of `hisaflow-quality-and-assistant-overhaul.md` (Duty 1 layout/UX, Duty 2 assistant, Duty 3 correctness) and the draft `hisaflow-ocr-scanning-plan.md`.
**Status:** Implemented, tested. Four independently reviewable layers, each gated (lint, type-check, unit tests, build).
**Date:** 2026-10-16.
**Defects:** Q-022 (OCR latency/repeat cost), Q-023 (barcode scan & external-lookup latency) — `hisaflow-overhaul-defect-log.md`.

This note records a session that made the existing OCR capture and barcode
scanner faster and more efficient, and turned a scanned receipt into an
editable line-item table.

---

## What was already in place (do not rebuild)

The implementation is further along than the original draft plan assumed. These
already existed before this session and were kept:

- `InventoryItem.barcode` + `@@index([organizationId, barcode])`, and
  `PackagingUnit.barcode`.
- A **cross-org shared barcode catalog** (`ProductCatalogEntry`, unique
  `barcode`, `source` MANUAL/OCR/OPEN_FOOD_FACTS/UPC_ITEM_DB, `confirmations`)
  that every org's confirmed product contributes to automatically in
  `InventoryService.create`.
- External fallback on a catalog miss: **Open Food Facts** then **UPCitemdb**,
  seeded back into the catalog (`GET /inventory/barcode/:code/external`).
- Barcode scan → lookup → `?scannedItemId=` / `?action=add&barcode=` routing,
  and `AddItemSheet` prefilling from the external provider first.
- Receipt OCR (`POST /ocr/receipt`) and label OCR (`LABEL_OCR` prompt), both
  routed through the `hisaflow-vision` gateway group.

So the "initial client base" answer was already: **catalog-first, then open
external datasets, then manual/label-OCR, contributing back to the catalog on
confirm**. This session closed the remaining speed gaps rather than replacing it.

---

## Layer 1 — OCR result cache & bounded output

**Problem (Q-022, Sev3):** every capture paid a fresh metered vision-model call,
even for the same image (a retry, a double-tap, a re-scan), and concurrent
identical uploads each called the gateway.

**What changed**

| File | Change |
|---|---|
| `apps/backend/src/modules/ocr/lib/ocr-cache.ts` (new) | `hashImage` (SHA-256) + a bounded, LRU/TTL `TtlCache`. Pure and clock-injectable. |
| `apps/backend/src/modules/ocr/ocr.service.ts` | 10-minute / 200-entry result cache keyed by image hash, in-flight promise dedupe so concurrent identical uploads share one call, and `max_tokens` bounding the vision output. |

**Guards:** `lib/ocr-cache.spec.ts` (expiry, LRU eviction, hashing),
`ocr.service.spec.ts` (repeat served from cache, content-keyed, concurrent dedupe,
max_tokens).

## Layer 2 — One round trip for capture → parse

**Problem (Q-022):** the client uploaded to `/ocr/receipt`, waited, then made a
second request to `/ai-ingestion/parse`, and the inventory context was fetched
only after the vision call.

**What changed**

| File | Change |
|---|---|
| `apps/backend/src/modules/ocr/ocr.controller.ts` | New `POST /ocr/receipt/parse` runs OCR then parsing in one request. The raw `POST /ocr/receipt` is kept for callers that only need text. |
| `apps/backend/src/modules/ai-ingestion/ai-ingestion.service.ts` | `warmInventoryContext(orgId)` lets the pipeline start the DB context fetch **while** the vision model runs, then hit the existing 90s cache. |
| `apps/backend/src/modules/ocr/ocr.module.ts` | Imports `AiIngestionModule`. |

Result: one client→server hop instead of two, and the context fetch overlaps the
slow vision call instead of following it.

**Guards:** `ocr.controller.spec.ts` (warm-then-OCR-then-parse, label source,
empty text skips parsing).

## Layer 3 — Editable receipt line-item table

**Problem:** multi-item receipts arrived as an accordion of AI "actions", not a
table, so reviewing a long receipt was slow. The request was a table the user
can edit and confirm.

**What changed**

| File | Change |
|---|---|
| `apps/frontend/components/system/ReceiptItemsTable.tsx` (new) | Editable grid: item, qty, unit, amount, type; per-row low-confidence flag and delete; footer with item count and an estimated total when costs were extracted. Rows are the same `CommittableAction`s the accordion edits, so the commit path is unchanged. |
| `apps/frontend/components/system/AiIngestionPanel.tsx` | Tracks the capture source. Receipt scans render the table ("Review scanned items"); free text keeps the accordion. Uses the combined endpoint and tunes compression to 1600px / 0.8 / 2MB. |
| `apps/frontend/services/ocr.service.ts` (new) | `ocrAndParseImage(blob, token, orgId, source)` wraps `POST /ocr/receipt/parse` with the existing auth headers. |
| `apps/frontend/hooks/useLabelOcrCapture.ts` | Uses the combined service (one round trip) and tunes label compression to 1600px. |

**Guards:** `ReceiptItemsTable.spec.tsx` (render, edit index, remove, total,
hidden removed rows), `useLabelOcrCapture.spec.tsx` (rewritten for the combined
service).

## Layer 4 — Barcode scanner & cold-start latency

**Problem (Q-023, Sev3):** the scanner decoded at 1080p on every animation frame
and required the same code for **5 consecutive frames**, so a successful scan
felt slow and burned battery. On cold start, a catalog miss queried Open Food
Facts **then** UPCitemdb sequentially (worst case ~8s) and repeated scans of the
same unknown good re-hit both APIs.

**What changed**

| File | Change |
|---|---|
| `apps/frontend/lib/barcode.ts` (new) | GTIN checksum validation, format list, and `requiredConfirmations`: **2 frames** for a checksum-valid EAN/UPC, 3 for checksum-less codes. Pure and testable. |
| `apps/frontend/components/system/BarcodeScannerSheet.tsx` | 1280×720 stream, detection throttled to ~120ms instead of every frame, native `BarcodeDetector` formats intersected with `getSupportedFormats()`, checksum-aware confirmation streak. ZXing fallback retained. |
| `apps/backend/src/modules/inventory/inventory.service.ts` | Open Food Facts and UPCitemdb are queried **in parallel** (worst case one timeout, not two), and a confirmed miss is remembered for one hour so repeat scans skip the APIs. Catalog-first ordering unchanged. |

**Cold-start strategy (the answer to “what about the initial client base?”).**
There is no provider that covers most East African goods, so coverage is built
up rather than bought:

1. **Own catalog first** — any item any org has barcoded resolves instantly and
   offline from `ProductCatalogEntry`.
2. **Open datasets second** — Open Food Facts and UPCitemdb fill the gap for
   manufactured/food goods, in parallel and cached.
3. **Human contribution** — confirming a new item with a barcode writes it to
   the shared catalog automatically (`source` MANUAL/OCR), so the *next* org —
   including the first cohort — benefits.
4. **Label OCR assist** — when a barcode is unknown and the product has printed
   text, label OCR prefills the manual form.

**Guards:** `lib/barcode.spec.ts` (checksums, length gate, confirmation counts,
format intersection), `BarcodeScannerSheet.spec.tsx` (2-frame EAN, 3-frame
checksum-less, partial reads, error recovery), `inventory.service.spec.ts`
(parallel providers + confirmed-miss cache).

---

## Gates

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | Pass |
| Backend unit tests | **107 suites / 845 tests** |
| Backend `nest build` | Pass |
| Frontend `tsc --noEmit` | Pass |
| Frontend `next lint` (repo-wide) | 0 errors (warnings only) |
| Frontend tests | **35 files / 198 tests** |
| Frontend `next build` | Pass |

## Deferred / follow-ups

- The OCR **single-pass multimodal extraction** (vision model returns the line
  items JSON directly) was considered but left out: it trades the transparent
  raw-text step for one fewer model call, and needs a prompt/eval pass. The
  cache + combined endpoint capture most of the repeat-scan win without that
  risk.
- A **bulk barcode CSV import** for businesses onboarding an existing catalog is
  a natural next step; the shared catalog and `create` contribution path already
  support it.
- The barcode scan itself still runs as a client-only ZXing fallback on browsers
  without `BarcodeDetector`; native coverage is now broad enough (Chrome/Edge,
  Safari 17+) that this is acceptable.
- Regional data for Open Food Facts is thin; seeding a curated East-African
  catalog remains a content task, not an engineering one.
