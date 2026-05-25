# UI Context

## Theme

Light mode by default, optimised for bright daylight conditions on mid-range
Android devices. The visual language is "quiet operational competence": calm,
readable, trustworthy. Not a startup dashboard. Not a crypto terminal. Not an
enterprise ERP. Every design decision should serve operational clarity —
helping a business owner understand what is happening and what to do next
within 5–10 seconds of opening the app.

Semantic color is the primary visual communication system. Every color token
carries operational meaning (healthy, warning, critical, informational).
Color is always paired with icons and labels — never used alone to communicate
status, for accessibility and daylight readability.

## Colors

All components use CSS custom properties. No hardcoded hex values anywhere in
component files. Define these in `globals.css` and map them through
`tailwind.config.ts`.

| Role                    | CSS Variable            | Value     | Meaning                                      |
| ----------------------- | ----------------------- | --------- | -------------------------------------------- |
| Page background         | `--color-bg-base`       | `#F7F8FA` | Soft off-white; lower eye strain than pure white |
| Surface / card bg       | `--color-bg-surface`    | `#FFFFFF` | Card and panel backgrounds                   |
| Elevated surface        | `--color-bg-elevated`   | `#F0F2F5` | Hover states, secondary surfaces             |
| Primary text            | `--color-text-primary`  | `#111827` | Deep charcoal; not pure black                |
| Secondary text          | `--color-text-secondary`| `#6B7280` | Labels, metadata, supporting context         |
| Muted text              | `--color-text-muted`    | `#9CA3AF` | Timestamps, captions, inactive states        |
| Border / divider        | `--color-border`        | `#E5E7EB` | Structural dividers; use generously           |
| Brand accent (primary)  | `--color-accent`        | `#1F7A5A` | Deep intelligent green; primary CTAs         |
| Brand accent (hover)    | `--color-accent-hover`  | `#195F47` | Hover / pressed state for primary accent     |
| Secondary accent        | `--color-accent-blue`   | `#2563EB` | Informational contexts; use sparingly        |
| Status: success/healthy | `--color-status-success`| `#15803D` | Healthy stock, completed actions             |
| Status: warning         | `--color-status-warning`| `#D97706` | Low stock soon, elevated usage, pending review |
| Status: critical        | `--color-status-critical`| `#DC2626` | Stockout imminent, failed sync, urgent action |
| Status: info            | `--color-status-info`   | `#2563EB` | Recommendations, neutral system guidance     |
| Status: neutral         | `--color-status-neutral`| `#6B7280` | Archived, inactive, metadata                 |

### Status Color Usage Rule

- **Success/Healthy**: stock levels above threshold, confirmed imports, synced
- **Warning**: the dominant operational state — most daily situations are
  warnings, not emergencies. Low stock approaching, delayed delivery, elevated
  usage.
- **Critical**: rare. Stockout imminent, transaction inconsistency, failed
  imports. Overusing critical destroys its meaning.
- **Info**: summaries, recommendations, passive guidance.

## Typography

Primary font: **Inter**. Reasons: exceptional readability, strong number
rendering (important for quantities and KES amounts), excellent mobile
rendering, lightweight.

Load via `next/font/google`:

```ts
import { Inter } from 'next/font/google'
export const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
```

| Role                    | CSS Variable    | Size  | Weight   | Usage                                      |
| ----------------------- | --------------- | ----- | -------- | ------------------------------------------ |
| Page heading (H1)       | `--font-sans`   | 32px  | 700      | Dashboard title, major onboarding screens  |
| Section header (H2)     | `--font-sans`   | 24px  | 600      | Dashboard sections, inventory categories   |
| Card title (H3)         | `--font-sans`   | 18px  | 600      | Card headings, modal titles                |
| Body primary            | `--font-sans`   | 16px  | 400–500  | Most readable text in the system           |
| Secondary / metadata    | `--font-sans`   | 14px  | 400      | Labels, supporting context                 |
| Caption / tiny          | `--font-sans`   | 12px  | 400      | Use sparingly; never dense passages        |
| Numeric display         | `--font-sans`   | 24px+ | 600–700  | KES amounts, stock quantities, KPIs        |

### Typography Rules

- Operational numbers (stock counts, KES amounts, thresholds) must be large
  and high-contrast.
- Use human language, not technical language.
  - Bad: "Inventory threshold anomaly detected"
  - Good: "Rice stock may run out tomorrow"
- Avoid dense paragraphs. Prefer short statements and action-oriented phrasing.

## Spacing Scale

Base unit: 4px. Map through Tailwind's `spacing` config.

| Token | Value | Tailwind class |
| ----- | ----- | -------------- |
| xs    | 4px   | `p-1`, `gap-1` |
| sm    | 8px   | `p-2`, `gap-2` |
| md    | 12px  | `p-3`, `gap-3` |
| lg    | 16px  | `p-4`, `gap-4` |
| xl    | 24px  | `p-6`, `gap-6` |
| 2xl   | 32px  | `p-8`, `gap-8` |
| 3xl   | 48px  | `p-12`         |

- Screen horizontal padding: `16px` minimum on mobile.
- Card internal padding: `16–20px`.
- Section separation: `24–32px`. Whitespace is operational clarity.
- Do not try to fit too much on screen. Especially on mobile.

## Border Radius

| Context                       | CSS Variable          | Value  | Tailwind class   |
| ----------------------------- | --------------------- | ------ | ---------------- |
| Inline elements, badges, tags | `--radius-sm`         | 6px    | `rounded-md`     |
| Cards, panels, inputs         | `--radius-card`       | 12px   | `rounded-xl`     |
| Large interactive surfaces    | `--radius-lg`         | 16px   | `rounded-2xl`    |
| Full-pill buttons, tags       | `--radius-pill`       | 9999px | `rounded-full`   |

Avoid sharp enterprise rectangles and excessively bubbly rounding.
The 12–16px range feels modern and grounded.

## Elevation

Elevation communicates interaction importance, not decoration.

| Level   | CSS Variable         | Tailwind         | Usage                                         |
| ------- | -------------------- | ---------------- | --------------------------------------------- |
| Level 0 | —                    | (none)           | Page background                               |
| Level 1 | `--shadow-card`      | `shadow-sm`      | Standard cards, list items                    |
| Level 2 | `--shadow-raised`    | `shadow-md`      | Active modals, bottom sheets, focused panels  |
| Level 3 | `--shadow-overlay`   | `shadow-lg`      | Critical overlays, confirmation dialogs       |

Avoid aggressive box shadows. Prefer subtle, layered separation.

## Component Library

shadcn/ui on top of Tailwind. Components live in `components/ui/`. Use the
shadcn CLI to add new primitives rather than writing them from scratch.

**Critical architectural distinction:**

- `components/ui/` — Raw shadcn primitives. These are unstyled operational
  primitives. Do not add business logic here.
- `components/system/` — Hisaflow semantic components built on top of shadcn
  primitives. These encode operational meaning.

Always reach for a semantic component first. If it doesn't exist, create it.

### Semantic Component Inventory

| Semantic Component     | Built on             | Purpose                                          |
| ---------------------- | -------------------- | ------------------------------------------------ |
| `AttentionFeed`        | Card, Badge          | Dashboard attention stream with severity levels  |
| `AlertCard`            | Card, Badge, Button  | Single alert with severity, context, action CTA  |
| `InventoryCard`        | Card                 | Product with quantity, health indicator, risk    |
| `OperationalSummary`   | Card                 | KPI metric with comparison and status accent     |
| `AIReviewPanel`        | Card, Badge, Input   | Editable AI proposal with confidence indicators  |
| `ActionBlock`          | Card, Button         | Recommendation with context and CTA              |
| `TransactionComposer`  | Sheet, Input, Button | Quick transaction entry (bottom sheet)           |
| `InventoryHealthCard`  | Card, Badge          | Fast-moving / dead stock / expiry risk summary   |
| `ConfidenceBadge`      | Badge                | "Looks correct" / "Please review" / "Needs attention" |
| `StatusDot`            | span                 | Inline health indicator (green/amber/red)        |

## Layout Patterns

### Mobile Shell (all primary screens)

```
┌──────────────────────────────┐
│  Top App Bar (48px)          │  Business name, contextual title, notification bell
│──────────────────────────────│
│                              │
│  Primary Operational         │
│  Content Area                │  Scrollable; section-separated with 24–32px gaps
│  (flex-1, overflow-y-auto)   │
│                              │
│──────────────────────────────│
│  Bottom Navigation (56px)    │  Home · Inventory · Transactions · Alerts · More
└──────────────────────────────┘
```

- Bottom navigation is persistent across all Tier 1 screens.
- Primary actions (log sale, add stock) should be reachable via a Floating
  Action Button (FAB) or bottom sheet trigger above the nav bar.
- Maximum preferred navigation depth: 3 layers.

### Bottom Navigation Tabs

```
Home | Inventory | Transactions | Alerts | More
```

Each tab answers one operational question:
- **Home** — "What needs my attention right now?"
- **Inventory** — "What do I currently have?"
- **Transactions** — "What changed?"
- **Alerts** — "What needs action?"
- **More** — Settings, staff, reports, billing (secondary flows)

### Cards

- Consistent `rounded-xl` (12px) on all cards.
- `shadow-sm` elevation.
- `16–20px` internal padding.
- `8–12px` gap between sections inside a card.
- Status accent applied via a left border stripe or a colored dot + label —
  never a full background flood.

### Bottom Sheets

Used for: quick actions (log sale, adjust stock), contextual detail (inventory
quick view, alert detail), AI review flow. Powered by shadcn `Sheet` /
`Drawer`. Each sheet has one dominant purpose.

### Modals / Overlays

- Centered overlay with a semi-transparent backdrop.
- `rounded-2xl` (16px).
- `shadow-lg` elevation.
- Always include a close affordance and a destructive / confirm action
  separated visually.

## Icons

Library: **Lucide React**. Outlined stroke icons only.

| Context                  | Size              | Tailwind          |
| ------------------------ | ----------------- | ----------------- |
| Inline in text           | 16px              | `h-4 w-4`         |
| Button icons             | 18–20px           | `h-[18px] w-[18px]` |
| Navigation icons         | 22px              | `h-[22px] w-[22px]` |
| Empty state / hero icons | 40–48px           | `h-10 w-10`       |

### Icon Semantic Mapping

| Operational Meaning   | Icon Name              |
| --------------------- | ---------------------- |
| Inventory             | `Package` / `Boxes`    |
| Alert / Warning       | `TriangleAlert`        |
| Trend up              | `TrendingUp`           |
| Trend down            | `TrendingDown`         |
| Transaction / Change  | `ArrowLeftRight`       |
| AI / Extraction       | `Sparkles` (subtle)    |
| Upload / Import       | `Upload` / `CloudUpload` |
| Reports / Analytics   | `BarChart2`            |
| Settings              | `Settings`             |
| Staff / User          | `Users`                |
| Notification          | `Bell`                 |
| Stock adjustment      | `Pencil`               |
| Delete / Remove       | `Trash2`               |
| Confirm / Success     | `CircleCheck`          |
| Low stock warning     | `PackageX`             |

Never overload interfaces with icons. Icons clarify; they do not replace
labels on critical operational controls.

## Motion

Minimal and purposeful.

- Alert feed item entrance: `fade-in` + `slide-up` (150ms ease-out)
- Bottom sheet transition: `slide-up` (200ms ease-out)
- Confirmation action feedback: `pulse` or `scale-up` (100ms)
- Data loading skeleton: `pulse` animation via Tailwind `animate-pulse`

Avoid flashy transitions, bouncing dashboards, and excessive motion.
The interface should feel calm under operational pressure.
