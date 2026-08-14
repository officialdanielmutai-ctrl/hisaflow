# HisaFlow — Business Specificity: Remaining Industries (Draft v1)

**Status:** Draft for review — scoping only, no implementation yet
**Covers:** Duka, Mini Mart, Wholesaler, Chemist, Restaurant, School, ISP
**Companion to:** the guest house vertical work already shipped — same underlying principle applies here: reuse the existing engine (inventory ledger, AI ingestion, alerts, invoicing) as the backbone, add industry-specific layers on top rather than rebuilding per industry.

---

## 0. The core finding

Not all seven industries are the same distance from what HisaFlow already does. Treating them as equal-sized work would misallocate effort. They split into three tiers:

**Tier 1 — Same model, missing details.** Duka, Mini Mart, Wholesaler. These are inventory-first businesses today and stay inventory-first — the gaps are unit-of-measure handling, pricing tiers, and credit terms, not new business objects.

**Tier 2 — Same model, new domain logic on top.** Chemist, Restaurant. These are still fundamentally "track stock, sell stock" businesses, but each needs one significant new capability layered onto inventory (batch/expiry-aware dispensing for chemist; recipe-based ingredient deduction for restaurant) — the same pattern as guest house's booking layer over InventoryTransaction.

**Tier 3 — Different category of software.** School, ISP. These aren't primarily inventory businesses at all. A school's core pain is fee billing and student records; an ISP's core pain is subscriber billing and network access control. Inventory is a minor, secondary concern for both (a school's tuck shop, an ISP's router/cable stock). Scoping these as "add inventory features" would miss what actually hurts. This needs to be said plainly rather than discovered mid-build: **these two are new product surfaces that happen to sit inside HisaFlow, not new flavors of the existing one.**

---

## 1. Duka / Mini Mart / Wholesaler (Tier 1)

### The actual pain
Not a missing feature — a missing **unit model**. A duka owner sells a single cigarette from a pack of 20; a mini mart sells a tin of cooking fat but buys it by the carton; a wholesaler sells by the carton to a retailer but tracks stock by the individual unit for reordering. Right now HisaFlow tracks one `unit` string per item with no conversion between purchase unit and sale unit — so "I bought 10 cartons" and "I sold 3 pieces" don't reconcile against the same stock count without manual math.

### What's needed
- **Unit conversion on `InventoryItem`** — a base unit (piece) plus optional pack size (e.g., 1 carton = 24 pieces), so purchases can be logged in cartons and sales in pieces against the same stock count.
- **Wholesaler-specific: tiered pricing** — price-per-unit that changes based on quantity purchased (buy 1 carton at X, buy 10+ cartons at Y). This is the single biggest gap for wholesaler specifically — it's currently indistinguishable from a duka in the data model.
- **Credit/running-tab tracking** — you already have this pattern (`CreditRecord.amountPaid` referenced in the guest house invoice work) — this should extend to regular retail sales for all three, since informal credit to regular customers is standard practice at this scale.

### Explicitly not new business objects
No new tables needed here — this is entirely additive fields on `InventoryItem` (pack size, tiered price rules) and reuse of whatever credit/ledger pattern already exists. Smallest lift of the seven.

---

## 2. Chemist (Tier 2)

### The actual pain (confirmed directly — "stuck with gms and kgs")
Medicine doesn't sell in weight units. It sells in tablets, capsules, ml, sachets, and packs-of-strips — and critically, **the same drug is dispensed at multiple unit levels**: a full box, a strip of 10 tablets, or a single tablet. A generic "unit" dropdown with gm/kg options is actively wrong for this industry, not just incomplete.

### What's needed
- **Pharmaceutical-appropriate unit types**: tablet, capsule, ml, sachet, strip, box — as first-class options, not squeezed into a generic unit field designed for groceries.
- **Batch number + expiry per stock entry** — not per item. The same drug (e.g., Paracetamol 500mg) will have multiple batches in stock simultaneously with different expiry dates. This needs to be tracked at the batch/lot level, with **FIFO logic surfaced to the seller** (sell the earliest-expiring batch first) — this is the single most-cited feature across every Kenyan pharmacy POS reviewed in research, and directly prevents the financial loss (expired stock write-off) that's the chemist owner's actual money problem, not just a labelling annoyance.
- **Expiry alerting** — 30/60/90-day pre-expiry warnings, reusing the alert engine you already have (it currently has an `EXPIRY_RISK` alert type sitting unused in the schema from the OCR/label work — this is exactly where it gets activated).
- **Prescription vs. OTC distinction** — a lighter-weight flag on the sale, not full e-prescription management. Kenyan regulatory compliance (PPB) around this is a deeper rabbit hole than a first phase needs — flag as a v2 consideration, not a v1 requirement.

### Data model implication
This needs a `StockBatch` (or similarly named) concept — `InventoryItem` stays the product definition, but a new child table tracks `(itemId, batchNumber, expiryDate, quantity)`. Sales deduct from the earliest-expiring batch with remaining quantity first. This is a real, non-trivial addition — it's the guest house `Booking`-to-`Room` pattern again: one stable parent record, one new child table capturing the thing that actually varies per unit of stock.

---

## 3. Restaurant (Tier 2)

### The actual pain
A restaurant doesn't sell what it stocks — it sells a **combination** of what it stocks. Selling one "Chicken Curry" should deduct rice, chicken, and three named spices from inventory in their recipe proportions, but nothing in the current model connects a sellable menu item to the raw ingredients it consumes.

### What's needed
- **Recipe / Bill of Materials layer** — a `MenuItem` (or reuse `InventoryItem` with a `isComposite` flag) that references a list of `(rawIngredientItemId, quantityUsed)` pairs. Selling the menu item triggers deduction of every linked ingredient in its recipe quantity — this is the entire value proposition of "restaurant POS" versus generic retail POS, confirmed repeatedly in research.
- **Table / order management** — orders tied to a table number, allowing multiple concurrent open orders, is standard even at small scale (a nyama choma joint has this exact need — several tables running tabs simultaneously before a single combined or split payment).
- **Kitchen order routing** — lower priority for a lean v1; a shared "orders" list that kitchen staff can see and mark as prepared covers 80% of the value without a dedicated printer/KDS integration, which is real hardware/infra scope.

### What NOT to build in v1
Full split-billing-per-guest-per-item, multi-printer kitchen routing, and KRA eTIMS fiscal receipt integration are all real restaurant-POS features but each is its own scoped effort — eTIMS in particular is a compliance integration, not a feature, and deserves its own dedicated planning pass rather than being folded into this one. Flag as explicitly deferred, not silently dropped.

---

## 4. School (Tier 3 — different category)

### The actual pain
A school's core operational pain is **fee collection and tracking**, not inventory. Research confirms Kenyan school software is built around: CBC-compliant grading and student records (a full student information system), M-Pesa fee collection with partial-payment/instalment tracking, and communication to parents. None of that is inventory.

### Where HisaFlow's model genuinely fits
A school's **tuck shop or store** (many Kenyan schools run one) is a legitimate, narrow fit for the existing inventory engine — that's just a duka operating inside a school. Worth building, small effort, real value.

**Fee tracking**, meanwhile, maps loosely onto the invoice/payment pattern already built for guest houses — a `Student` (parallel to `Guest`), a `FeeInvoice` (parallel to `Invoice`), and a `Payment` ledger. This is a legitimate reuse of what you already have, not a from-scratch build.

### What should explicitly NOT be attempted as part of this
- CBC/8-4-4 grading, report cards, competency tracking — this is a specialized education-domain feature set (grade books, curriculum-aligned rubrics) that has nothing to do with HisaFlow's core competence and would essentially mean building a second product.
- Timetabling, attendance/biometric tracking, HR/payroll for teaching staff — same reasoning.

### Recommendation
Scope "School" in HisaFlow narrowly and honestly: **fee billing/tracking + optional tuck shop inventory.** Market it as solving the financial-administration pain, not as a school management system. If full academic/SIS functionality is ever wanted, that's a decision to make consciously later — not something to half-build now under the guise of "business specificity."

---

## 5. Internet Service Provider / ISP (Tier 3 — different category)

### The actual pain
An ISP's core pain is **recurring subscription billing tied to network access control** — when a customer's payment lapses, their internet needs to actually cut off; when they pay, it needs to reconnect automatically. Every Kenyan ISP billing tool researched centers on this exact loop: MikroTik router API integration, M-Pesa STK push for renewals, automatic suspend/reconnect, and SMS/WhatsApp payment reminders.

### Why this is structurally unlike everything else in HisaFlow
Every other vertical in HisaFlow (including guest house) is about tracking **things that exist in physical space** — stock, rooms, tables. ISP billing is about tracking **recurring time-based access** and integrating with **external network hardware** (a MikroTik router's API) that HisaFlow has never needed to talk to. This is a genuinely different technical problem, not a bigger version of the same one.

### What's needed if this is pursued
- **Subscriber management** — a `Subscriber` record (name, phone, plan, connection type: PPPoE/Hotspot/Static IP), separate from any inventory concept.
- **Recurring billing/plans** — subscription plans with a price and renewal cycle, automated invoice generation on cycle, M-Pesa STK push integration for renewal payment (you already have Africa's Talking for SMS — this pattern extends, doesn't replace).
- **MikroTik router integration** — this is the hard, genuinely new piece. It requires the backend to speak to a MikroTik router's API (either directly or via a RADIUS server) to suspend/reconnect subscribers based on payment status. This is meaningfully more complex than anything else in this document — it's an external systems integration with hardware in the field, not a schema addition.

### Recommendation
Treat ISP as a **separate, later-phase decision**, not part of this same body of work. If pursued, it should get its own dedicated scoping document once there's a real ISP customer to build against — building MikroTik integration speculatively, without a live network to test against, is exactly the kind of work that goes wrong silently. Worth being direct about this rather than including it in a phase plan that implies it's the same size of effort as adding pack-size fields to a duka.

---

## 6. Suggested priority order

Ranked by (value unlocked) ÷ (distance from what already exists) — cheapest wins first, hardest/most-speculative last:

1. **Duka / Mini Mart / Wholesaler unit + tiered pricing** — smallest lift, fixes a real complaint, no new tables.
2. **Chemist batch/expiry** — moderate lift, reuses patterns already built (guest house consumption, OCR expiry field, existing alert engine), addresses a direct financial pain (expired stock loss) not just a UI annoyance.
3. **Restaurant recipe/BOM layer + basic table orders** — moderate-to-larger lift, clear standalone value, no dependency on anything uncertain.
4. **School fee billing + optional tuck shop** — reuse of guest house's invoice/payment pattern, but requires an explicit, stated decision to scope out full SIS functionality so expectations don't drift during build.
5. **ISP** — do not build alongside the above four. Separate scoping pass, later, ideally against a real customer's actual MikroTik setup.

## 7. Open questions before any phase plan gets written

1. Is there a real chemist, restaurant, or school customer lined up to validate against, the way the guest house work had actual conversations behind it? The chemist gms/kgs complaint is a real, direct signal — worth confirming similar direct signal exists (or gathering it) for restaurant and school before investing build time, the same way it was gathered for guest house.
2. For School: is fee billing alone actually sufficient to be worth shipping, or does the target customer expect at least minimal student records (name, class, guardian contact) alongside it? Worth a direct conversation before scoping Phase 1, the same way guest house started with real operator interviews.
3. For ISP: is there already a specific prospective customer with a MikroTik setup, or is this speculative? This materially changes whether it's worth any scoping effort right now at all.
