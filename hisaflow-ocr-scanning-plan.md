# HisaFlow — OCR & Barcode Scanning Implementation Plan (Draft v1)

**Status:** Draft for review — no code written yet
**Scope:** Two distinct capture pipelines that both feed into the existing AI ingestion → confirm → create flow.

---

## 0. Correction to the original framing

The request describes one capability ("industry-grade OCR, from receipt contents to scanning a QR code for name/expiry/manufacturer") but this is actually **two different technical problems** that happen to share a destination:

| | Receipt / document OCR | Barcode / QR scanning |
|---|---|---|
| What it reads | Printed text on a photographed receipt or invoice | A structured code (barcode/QR) printed on a product |
| Tech | Google Cloud Vision API (`DOCUMENT_TEXT_DETECTION`) | Browser-native `BarcodeDetector` API, JS fallback library — **not** Cloud Vision |
| Where it runs | Server-side (backend calls Google, image never needs raw processing client-side) | Client-side, in the browser, no network call needed to decode |
| Output | Raw text → needs an LLM (existing Gemini ingestion) to structure it | A code string → needs a lookup against your own product database |

Google Cloud Vision has no barcode/QR feature in its API surface — that lives in a different Google product (ML Kit, mobile-only). Building this as "send image to Google Vision, get back name/expiry/manufacturer from a QR code" won't work, because a QR code on a product typically encodes a plain identifier (a SKU, a GS1 code, sometimes a URL) — not free text Vision could OCR. The manufacturer/expiry/name data has to come from **somewhere else** once you have that identifier: either your own item record (if this SKU has been scanned before) or manual entry the first time, optionally assisted by a receipt-OCR pass if the product's packaging has printed text Vision *can* read.

This plan treats them as two pipelines that converge on the same review-and-confirm screen, not one feature.

## 1. Foundational gap: no barcode field exists yet

`InventoryItem` currently has no field to store a scanned code. Barcode scanning is a dead end without it — you'd read a code and have nothing to match it against. This needs to land in Phase 1, not be assumed:

```prisma
// Additive to InventoryItem — nullable, no migration risk to existing rows
barcode   String? @map("barcode")
@@index([organizationId, barcode])
```

First scan of a new product: no match found → user fills in details manually (or via receipt OCR if scanning a printed price tag/label) → barcode gets saved against that item. Every scan after that is instant.

## 2. Pipeline A — Receipt / Document OCR

**Flow:** Camera/photo upload → backend uploads image to Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) → raw text returned → raw text fed into the **existing** AI ingestion service (Gemini) with a receipt-specific prompt → structured draft (items, quantities, unit costs, supplier name if present) → same confirm screen your AI ingestion panel already uses today.

This is the key reuse point: **you already built the "AI parses text into a draft the user confirms" pipeline** for the guest house booking work and the original text-ingestion feature. OCR just becomes a new *source* of text feeding that same pipeline — it does not need its own parsing/confirmation UI built from scratch.

```
Photo → [NEW] OCR endpoint (Vision API) → raw text
      → [EXISTING] AI ingestion service, new prompt variant for "receipt" source
      → [EXISTING] draft/confirm UI, extended to show which fields came from OCR vs. inferred
```

### Backend additions
- `[NEW] apps/backend/src/modules/ocr/ocr.module.ts`
- `[NEW] apps/backend/src/modules/ocr/ocr.service.ts` — wraps the Google Cloud Vision REST call. **API key never touches the frontend** — image is uploaded to your backend, backend calls Google server-side, using `CLOUD_VISION_API_KEY` already sitting (as a placeholder) in your Railway variables.
- `[NEW] POST /ocr/receipt` — accepts an image (multipart or base64), returns raw extracted text + confidence score.
- `[MODIFY] ai-ingestion.service.ts` — add a `source: 'RECEIPT_OCR'` prompt variant. The prompt should explicitly tell the model the text came from OCR and may contain scan artifacts (misread characters, broken line alignment) — asking it to reconcile likely OCR errors (e.g. "O" vs "0", "l" vs "1") is worth one line in the prompt.

### Frontend additions
- `[NEW] apps/frontend/components/system/OcrCaptureSheet.tsx` — camera capture or file picker, image preview, "Scan" button, loading state, then hands off to the **existing** AI ingestion draft/confirm UI.
- Entry point: an additional option alongside the existing "Ask AI" text input — "Scan a receipt" — not a separate feature area.

### Image handling requirements (this is what "industry grade" actually buys you)
- **Client-side compression before upload** — resize to a sane max dimension (e.g. 1600px longest edge) and compress to JPEG before sending. Vision API accuracy doesn't improve past a certain resolution, and uncompressed phone photos are 5–15MB — expensive and slow on the connections your users are actually on.
- **Confidence thresholds** — Vision returns per-block confidence scores. Anything below a set threshold should be flagged in the UI ("low confidence — please verify this line") rather than silently fed to the AI parser as if it were certain.
- **Retry/error handling** — Vision API calls can fail (network, quota, malformed image). The UI needs an explicit failure state with a retry action, not a silent hang.
- **Cost ceiling awareness** — Vision is metered (~1,000 free units/month per feature, then billed per 1,000 calls). Track usage per organization if this becomes heavily used, so one business scanning constantly doesn't blow past free tier unnoticed. Not urgent for launch, worth a placeholder counter.

## 3. Pipeline B — Barcode / QR Scanning

**Flow:** Camera opens in-browser → native decode (no network round-trip) → code string → backend lookup against `InventoryItem.barcode` for this organization → match found → show item, jump straight to quantity/action (e.g. "add stock", "log consumption" for a guest house room) → no match → fall through to manual entry (optionally offering receipt OCR as an assist if there's a printed label to photograph).

### Frontend additions
- `[NEW] apps/frontend/components/system/BarcodeScannerSheet.tsx` — uses the browser's native `BarcodeDetector` API where available (Chrome/Edge on Android support it; iOS Safari support is inconsistent as of writing — **needs a runtime capability check**, not an assumption).
- Fallback: a lightweight JS decoding library (e.g. `@zxing/browser` or `html5-qrcode`) for browsers without native `BarcodeDetector` support, so this doesn't silently fail to work on a meaningful share of phones.
- On decode: call `GET /inventory/lookup-barcode/:code` (new, lightweight, org-scoped).

### Backend additions
- `[MODIFY] inventory.controller.ts` — add `GET /inventory/lookup-barcode/:code`, org-context gated, returns the matching item or 404.
- `[MODIFY] create-inventory-item.dto.ts` / update DTO — accept optional `barcode` field so it can be saved on first manual entry.

### Why this belongs client-side, not server-side
Sending every camera frame to a backend for barcode decoding would be slow (network round-trip per frame) and pointless — barcode decoding is a solved, fast, local problem. Reserve the network call for the *lookup*, not the *decode*.

## 4. Where the two pipelines meet

Both end at the same place: either an existing `InventoryItem` gets acted on (stock added, consumption logged) or a new one gets created via the same confirm screen the text-based AI ingestion already uses. No new "third" data-entry surface should be built — OCR and barcode scanning are two new *inputs* into flows that already exist.

## 5. Open questions

1. **Where does scanning live in the UI?** As a new tab, or as an additional entry point on the existing "Add Item" / "Ask AI" flows? Given your nav is already tight (5-tab BottomNav, guest house variant included), recommend the latter — a scan icon next to the existing AI input, not a new destination.
2. **Multi-item receipts** — a single receipt often lists many products. Does the confirm screen need to support editing/removing individual line items before bulk-creating them, or is one-at-a-time acceptable for v1? Recommend supporting bulk edit-before-confirm from day one — this is the main value of receipt OCR (saving many manual entries at once), so a one-at-a-time flow would undercut the point of the feature.
3. **Barcode format scope** — do you need to support 1D formats (EAN-13, UPC-A — common on manufactured goods) in addition to QR, or is QR-only sufficient for now? Most East African retail/wholesale goods carry EAN-13 barcodes, not QR — worth confirming this explicitly rather than assuming QR is the primary format in practice.

## 6. Suggested phase order

1. **Schema** — add `barcode` to `InventoryItem`.
2. **Barcode scan + lookup** (client-side decode, backend lookup endpoint) — smaller, self-contained, immediately useful even before OCR exists.
3. **Receipt OCR backend** (Vision integration, raw text endpoint).
4. **Receipt OCR → AI ingestion bridge** (new prompt variant, reusing existing confirm UI).
5. **Polish** — confidence-score UI treatment, retry states, usage tracking.

## 7. Verification checklist

| Check | Expected result |
|---|---|
| Scan a known barcode | Item found instantly, no OCR/AI call made |
| Scan an unknown barcode | Falls through to manual entry; new item saves with that barcode attached |
| Photograph a clear receipt | Draft correctly lists items/quantities; user can edit before confirming |
| Photograph a blurry/low-light receipt | Low-confidence lines are visually flagged, not silently trusted |
| Vision API call fails (simulate network drop) | User sees a retry option, not a silent failure |
| iOS Safari (no native BarcodeDetector) | Fallback scanner library still decodes correctly |
| Non-org-scoped barcode lookup | Confirm lookup only matches items within the requesting organization — no cross-tenant leak |
