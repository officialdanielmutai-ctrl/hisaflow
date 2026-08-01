# HisaFlow — Guest House / Hotel Industry Scope

**Status:** Draft for review
**Author:** Daniel Mutai (Spacefix Digitals)
**Purpose:** Define what "guest house/hotel" support means as a new HisaFlow industry vertical, and what "done" looks like for each piece.

---

## 1. The problem

HisaFlow currently treats every business as a generic inventory tracker with a finance page and a notes page bolted on. That's enough for a retail shop, but a guest house owner doesn't think in SKUs — they think in **rooms**, **guests**, and **stays**. Right now they can log stock, but they can't answer basic questions like "who's in Room 4," "what does this guest owe me," or "what did Room 4 use across their 3-night stay."

That gap is why they're still on Excel and paper booking sheets. Excel doesn't fail because it's ugly — it fails because nothing in it is connected. A booking is one sheet, room status is a whiteboard, consumption is a notebook by the bar, and the invoice is manually assembled from all three at checkout. The goal here isn't "add hotel features" — it's **remove the manual reconciliation step** that happens right now at every checkout.

## 2. Who this is for

- Guest houses, B&Bs, and small independent hotels (roughly 3–40 rooms) — the segment too small for enterprise PMS platforms (Cloudbeds, Mews, roommaster) but too complex for a plain inventory app.
- One or two people typically run front desk, housekeeping, and billing simultaneously — so the workflow has to be fast, not feature-heavy.
- East African context: cash and M-Pesa are dominant payment methods, phone-based booking/WhatsApp inquiries are common, and multi-day, walk-in-heavy stays are more typical than OTA-driven bookings.

## 3. What's already researched as industry-standard (beyond what you were told directly)

Talking to your contacts surfaced rooms, bookings, consumption tracking, guest lifecycle, and invoicing. Industry research confirms those are the core five, and adds a few things that consistently show up as expected even in small-property PMS tools:

- **Room status tracking** (clean / dirty / occupied / under maintenance) — separate from booking status. A room can be vacant but not yet cleaned.
- **Guest profile persistence across stays** — a returning guest shouldn't be re-entered from scratch; their history (past stays, preferences, outstanding balances) should be visible.
- **Rate handling per room/room-type** — even simple guest houses vary price by season, room type, or negotiated rate — this needs to exist even at a basic level or invoicing breaks.
- **Deposit / partial payment handling** — very common at check-in; the invoice needs to support partial settlement, not just a single total at the end.
- **A single consolidated bill at checkout** — room charge + all logged consumption + any manual line items, generated without manual arithmetic.

Explicitly **not** in this scope (flagged so it's a conscious decision, not an oversight): OTA/channel manager integration (Booking.com, Airbnb sync), a public-facing direct booking engine/website, and multi-property management. These are real PMS features but are a different product tier — safe to leave for a later phase if demand shows up.

## 4. Feature scope for this phase

### 4.1 Room Management
Add, edit, and deactivate rooms. Each room has a name/number, type (e.g. Single, Double, Suite — configurable per business), base rate, and status (Vacant/Clean, Vacant/Dirty, Occupied, Maintenance).

**Done when:**
- Owner can create/edit/deactivate a room in under 30 seconds.
- Room list view shows live status for every room at a glance (this becomes the new "dashboard" for this industry, replacing the whiteboard).
- Room status updates automatically on check-in/check-out, and can be manually overridden (e.g. marking Maintenance).

### 4.2 Booking / Reservation
Create a booking against a room for a date range, either for a walk-in (starts immediately) or a future reservation. A booking links to a guest profile.

**Done when:**
- A booking can be created in one flow: pick room → pick/create guest → set dates → confirm.
- The system prevents double-booking a room for overlapping dates.
- Bookings have a status: Reserved, Checked In, Checked Out, Cancelled, No-show.
- A calendar or list view shows current and upcoming bookings per room.

### 4.3 Guest Profiles
A guest exists as a persistent record, not a field on a booking.

**Done when:**
- Guest record stores name, phone, ID/passport number (optional), and notes.
- Guest record shows full stay history (past and current bookings, past invoices).
- Creating a booking can either select an existing guest or create a new one inline — no duplicate data entry.

### 4.4 Consumption Tracking (per room, per stay)
This is where HisaFlow's existing inventory engine actually pays off — it's the differentiator versus a plain hotel booking app. Any inventory item (drinks, snacks, room service, laundry, etc.) can be logged against an **active booking**, not just a general sale.

**Done when:**
- From an active booking, staff can add a consumption line item (pick inventory item → quantity → optional note) in a few taps.
- Each logged item deducts from inventory stock exactly like a normal sale does today.
- All consumption for a stay is visible in one place, tied to that specific booking/room/guest — not mixed in with general shop transactions.

### 4.5 Invoicing
At checkout, generate one invoice combining room charges (rate × nights) and all logged consumption for that stay, plus support for manual line items (e.g. a damage charge) and deposits already paid.

**Done when:**
- Invoice auto-calculates: room total + consumption total + manual adjustments − deposits paid = balance due.
- Invoice can be marked as partially or fully paid, with payment method recorded (cash, M-Pesa, card).
- Invoice is viewable/printable/shareable (PDF or shareable link) and remains attached to the guest's history after checkout.
- Checking out a booking is blocked (or explicitly warned) if there's an unpaid balance, unless the owner overrides it.

### 4.6 Client Data Management
Update or correct guest details at any point, not just at creation.

**Done when:**
- Guest profile fields are editable at any time from the guest record itself, independent of any specific booking.
- Edits don't retroactively change past invoices (invoices are a snapshot at time of issue).

## 5. Data model additions (high level, for planning — not final schema)

New entities: `Room`, `RoomType` (optional, or a field on Room), `Booking`, `Guest`, `Invoice`, `InvoiceLineItem`.
`Booking` links `Room` + `Guest` + date range + status.
Consumption reuses the existing `InventoryTransaction` model, extended with an optional `bookingId` reference so a transaction can be tied to a stay.
`Invoice` aggregates room charge (derived from Booking) + linked `InventoryTransaction`s for that booking + manual `InvoiceLineItem`s.

## 6. Suggested phase order

1. **Rooms** — foundational, nothing else works without it.
2. **Guests + Bookings** — the reservation core.
3. **Consumption linking** — wire existing inventory logging to an active booking.
4. **Invoicing** — the payoff feature; depends on 1–3 being solid.
5. **Polish** — room status dashboard, guest history views, checkout warnings.

## 7. Explicitly out of scope for this phase

- OTA/channel manager sync (Booking.com, Airbnb, Expedia)
- Public direct-booking website/engine
- Multi-property support
- Dynamic/seasonal pricing automation
- Digital key / contactless check-in
- Housekeeping task assignment to specific staff (status tracking only, not task management)

These are legitimate next-phase candidates once the core loop above is in production and validated with real guest houses — worth revisiting after adoption data comes in, not before.
