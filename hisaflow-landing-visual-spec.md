# HisaFlow — Landing Page: Visual Design & Build Specification

**Status:** Ready for agents; decisions defaulted (Section 14)
**Supplements:** `hisaflow-landing-page.md` (structure, funnel, claims policy, phases L-A to L-F). This doc defines **how the page looks, feels, and is built**. Where the two conflict on *content or claims*, `hisaflow-landing-page.md` wins. Where they conflict on *visual treatment*, this doc wins.
**Ground rules:** `hisaflow-agent-build-briefs.md` Part 1 applies in full (non-regression, lint, CI, definition of done).
**Reference images** (human must add these to the repo at `docs/design-references/` so agents can open them; they are internal references and must **never** be shipped in the public bundle):
- `Hero.jpg` — the hero reference (light, pastel finance-app hero, floating pill nav, phone mockup, flanking cards, logo row)
- `section-1.jpg` — services panel reference (dark canvas, photo hero, white panel with headline + 2×2 bento, four-column feature footer)
- `section-2.jpg` — stacked-card reference (tinted canvas; alternating white and black rounded cards; inline-image headlines; counters; list rows)

---

## 1. What the references contribute — and what is forbidden to copy

### 1.1 Take: structure, proportion, rhythm, component grammar
The references share one design grammar. The page must be built from it deliberately:

| Trait | Where seen | What it is |
|---|---|---|
| **Inset card sections** | all three | Sections are large rounded containers sitting on a tinted canvas with small uniform gaps between them — not full-bleed bands |
| **Floating capsule nav** | Hero, section-1 | White pill inset from the container edge; logo left, links center, dark/orange CTA pill right |
| **Pill + circle-arrow buttons** | all | Fully rounded buttons; the primary has a small circle containing an arrow (↗/→) on its right |
| **Eyebrow micro-labels** | section-2 | Tiny uppercase label with a leading dot: `• THE PROGRAM`, `• CURRENT EVENTS` |
| **Inline-image headlines** | section-2 | A small rounded image chip sitting *between words* of a large headline |
| **Light/dark rhythm** | section-2 | White card, then tinted, then black card — alternating |
| **Bento grids** | section-1, section-2 | Mixed-size cards (photo, solid-accent, outline, text) aligned to one grid |
| **List rows with a highlighted active row** | section-2 | Hairline-divided rows with ↗ at right; the active row is a solid accent pill with tag chips |
| **Counter numerals** | section-2 | `01 /8` — large numeral with the total in light grey, plus prev/next circle buttons |
| **Floating UI cards over imagery** | Hero, section-2 | Small white product-UI cards overlapping a phone or photo, at staggered heights |
| **Glass chips over photos** | section-1, section-2 | Small frosted labels on images ("2.88k Membership", "View More") |
| **Faded device mockup** | Hero | Phone centered, bottom fading into the container background |
| **One accent colour** | section-1, section-2 | Black, white, and a single saturated accent used for active/primary highlights |

### 1.2 Forbidden to copy
- Any **text, brand names, logos, product names, or photography** from the references (Mintro, Netdot, Sparkweb, Pixelpath, CodeLine, Digitech, "Train Your Dog", the sports copy, the garbled text). The references are inspiration for layout only.
- Any **claim-shaped content** (see 1.3).
- Pixel-for-pixel duplication. The result must feel like HisaFlow's own page built on the same grammar, not a re-skin.

### 1.3 Reference slots that conflict with our honesty policy — fill with true content
The hero reference contains three trust-signal slots we cannot truthfully fill at launch (`hisaflow-landing-page.md` Sections 4 and 6). Keep the **layout slot**, replace the **content**:

| Reference slot | Reference content | HisaFlow content rule |
|---|---|---|
| Left floating card with avatars + "2.5M Active Users" | Invented-looking user count | A feature card: *"Pay by M-Pesa, matched to the sale"* with three small industry chips instead of avatars. **Only if M-Pesa is live** (claims flag); otherwise *"Built in Kenya, for Kenyan businesses."* **No avatar stack and no user count until real and verifiable.** |
| Right floating card with 5 green stars + review quote | Fake-feeling review | A **founder note** card (one short sentence + name + role) **only if the owner supplies and approves it**. If not supplied, omit the card entirely; the layout must still look balanced (Section 5.2 fallback). **Never invent a review, star rating, or name.** |
| Bottom "Trusted by…" logo row | Customer logos | A **"Built for" row**: text + small monochrome icons for Shops · Guest houses · ISPs · Schools (only live or "Coming soon"-labeled verticals), styled exactly like the logo row (same weight, spacing, grey). Payment-partner marks (M-Pesa, Paystack, Visa/Mastercard) only if each brand's usage guidelines permit it — **verify before using any third-party logo**; otherwise use plain text. |

---

## 2. What "engineered, not AI-looking" means here (enforceable rules)

"AI-looking" pages share identifiable tells. "Engineered" pages share the opposite properties. These are build rules and review criteria, not taste.

### 2.1 Tells to avoid
- Purple→blue gradient blobs, neon glows, heavy blur "orbs".
- Identical three-column icon-card grids with rainbow icon tiles.
- Stock illustrations, 3D render blobs, emoji used as icons.
- Everything centered and symmetrical; every card the same size.
- Random corner radii and mixed shadow styles.
- Vague superlative copy ("seamless", "revolutionary", "unlock the power", "all-in-one solution").
- Fake dashboards whose numbers don't add up or whose labels are lorem-ish.
- Text over busy photos with no scrim; low-contrast grey-on-grey.
- Auto-playing carousels, scroll-jacking, constant floating/bobbing animation.
- Icons from mixed sets or at inconsistent stroke weights and sizes.

### 2.2 Properties to enforce
1. **One system, no one-offs.** Every radius, shadow, spacing value, font size, and colour comes from the tokens in Section 3. A literal value in a component (e.g. `border-radius: 22px`) is a defect.
2. **A real grid.** Cards align to shared grid lines; bento tiles differ in span, not in alignment.
3. **Real product UI.** Phone mockups and floating UI cards are built from actual app screenshots of a seeded demo organization, with Kenyan-realistic KES values that **add up** (Section 5.2.4).
4. **Specific, local copy.** KES, M-Pesa, duka, guest house, router, stock, receipt. Short sentences. No filler adjectives.
5. **Deliberate asymmetry and rhythm.** Alternate light and dark cards; vary tile sizes on the grid; left-align body text (centering is reserved for hero and final CTA).
6. **Optical precision.** Icons optically centered in circles; consistent icon set and stroke; text baselines aligned across adjacent cards; tabular numerals for all figures.
7. **Restraint.** One accent colour. Motion only where it communicates state. Shadows subtle and from a three-step scale.
8. **Details that survive zoom.** Hairline borders (1px), crisp device frame built in CSS/SVG (not a blurry PNG), `font-feature-settings` for numerals, no pixelated images.

---

## 3. Design tokens (single source of truth)

Implement as CSS variables (or extend the Tailwind theme **if** the repo already uses Tailwind — inspect the existing frontend styling system first and conform to it; do not introduce a second styling system). All values below are **defaults derived from the reference proportions** and are tunable in one place.

### 3.1 Colour
| Token | Default | Use |
|---|---|---|
| `--canvas` | `#ECEEF5` | Page background behind cards (cool light tint, as in section-2) |
| `--surface` | `#FFFFFF` | Light cards |
| `--ink` | `#0B0C0E` | Primary text, dark cards, primary buttons |
| `--ink-2` | `#4A4F5A` | Secondary text |
| `--ink-3` | `#8B909C` | Tertiary text, micro-labels, inactive numerals |
| `--line` | `#E2E5EC` | Hairline borders/dividers on light |
| `--line-dark` | `rgba(255,255,255,.12)` | Hairlines on dark cards |
| `--accent` | `#FF5A1F` | **The single accent**: active rows, highlight buttons, key chips, the Team plan highlight |
| `--accent-ink` | `#FFFFFF` | Text on accent |
| `--mesh-a` | `#E4F3DA` | Hero mesh gradient (soft green) |
| `--mesh-b` | `#DCEEFA` | Hero mesh gradient (soft blue) |
| `--success` / `--warn` / `--danger` | `#1F9D55` / `#D98A00` / `#D64545` | Only inside product UI mockups |

Rules: accent covers **≤ ~10% of any viewport**. Hero primary buttons are **ink**, not accent (as in the hero reference); accent first appears below the hero, which gives the page a deliberate "arc". All text/background pairs must meet WCAG AA (4.5:1 body, 3:1 large). Verify `--ink-3` and `--accent` pairs explicitly; adjust tokens, not components, if a pair fails. **The brand accent colour is an owner decision — Section 14.**

### 3.2 Radius scale
`--r-pill: 999px` · `--r-section: 32px` (section containers) · `--r-card: 24px` (cards) · `--r-inner: 16px` (inner cards, chips with text) · `--r-sm: 10px` (small controls). Mobile: `--r-section: 24px`, `--r-card: 20px`. Nothing else is permitted.

### 3.3 Spacing (4-pt scale)
`4, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128`. Section-to-section gap: **12px mobile / 16px desktop** (the tight gutters in the references are part of the look). Card inner padding: **20px mobile / 32px tablet / 40px desktop**. Outer page margin (canvas visible at the sides): **8px mobile / 16px tablet / 24px desktop**. Max content width of the card column: **1360px**, centered.

### 3.4 Elevation (3 levels only)
- `--e0`: none (flat cards on canvas; most surfaces)
- `--e1`: `0 1px 2px rgba(16,24,40,.06), 0 4px 12px -4px rgba(16,24,40,.08)` (small floating chips)
- `--e2`: `0 12px 32px -12px rgba(16,24,40,.16), 0 2px 6px rgba(16,24,40,.06)` (floating UI cards, rotated card)
No coloured glows. No blur-heavy drop shadows.

### 3.5 Typography
- **One family**, variable weights, self-hosted at build time (use the framework's built-in font optimization; no runtime requests to a font CDN — this also fits the page's CSP and performance budget). Default: **Plus Jakarta Sans** (geometric neo-grotesk with the heavy, tight look of the references). Verify availability and licence (OFL) at build time. Fallback stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Use `font-display: swap` with size-adjusted fallback to prevent layout shift.
- **Scale** (fluid with `clamp`; desktop ≈ at 1440px):
  | Token | Size | Weight | Line-height | Tracking | Use |
  |---|---|---|---|---|---|
  | `display` | `clamp(2.5rem, 1.4rem + 4.2vw, 4.5rem)` (40→72) | 700 | 1.02 | −0.035em | Hero headline |
  | `h2` | `clamp(2rem, 1.3rem + 2.6vw, 3.5rem)` (32→56) | 700 | 1.06 | −0.03em | Section headlines |
  | `h3` | `clamp(1.25rem, 1.05rem + .8vw, 1.75rem)` | 600 | 1.2 | −0.02em | Card titles |
  | `body-lg` | 18px | 400 | 1.55 | −0.005em | Hero sub, lead text |
  | `body` | 16px | 400 | 1.55 | 0 | Default |
  | `small` | 14px | 400–500 | 1.45 | 0 | Card descriptions |
  | `eyebrow` | 11–12px | 600 | 1 | +0.08em, UPPERCASE | `• LABEL` micro-labels |
  | `numeral` | `clamp(3rem, 2rem + 4vw, 5rem)` | 600 | 1 | −0.04em, `tabular-nums` | Counters, big figures |
- Headlines: max 2–3 lines desktop, `text-wrap: balance`; body copy `text-wrap: pretty`; measure ≤ 60ch for paragraphs.
- All figures (`KES 48,350`, `01 /4`, prices) use `font-variant-numeric: tabular-nums`.

### 3.6 Iconography
One icon set, one stroke weight (**1.5px**), one default size (**20px**; 16px inside chips, 24px max). Check what the repo already ships (e.g. an installed icon library) and reuse it, importing only the icons used (tree-shaken). Icons inside circles must be optically centered (adjust 0.5px if needed; arrows ↗ sit slightly down-left of geometric centre to look centred).

---

## 4. Component specifications

Build each as a reusable component with variants, states, and keyboard behaviour. Define once; reuse everywhere.

### 4.1 `FloatingNav` (reference: Hero, section-1)
- A **capsule** (`--r-pill`), `--surface` background, 1px `--line` border (or `--e1`), height **56px desktop / 52px mobile**, inset **16px** from the top and sides of the hero container; sticky after scroll with a subtle `--e1` increase (no layout shift).
- Layout: logo (left) · links (center, 3–5, `small` weight 500, `--ink-2`, active/hover `--ink`) · right group: **Sign in** (text link) + **Start free trial** (primary button, ink).
- A WhatsApp icon-link sits in the right group before Sign in (desktop only; in the mobile menu it's a full row).
- **Mobile (<768px):** logo left, menu button (44×44 circle) right; menu opens as a full-width sheet beneath the capsule with the same radius scale, links as large tappable rows, CTA at the bottom. Focus is trapped while open; `Esc` closes; scroll-lock without layout jump.
- Hover on links: colour change plus a 2px underline that grows from the left (150ms). Focus-visible: 2px `--accent` ring with 2px offset.

### 4.2 `Button`
- Variants: `primary` (ink bg, white text), `secondary` (transparent, 1px `--ink` border), `accent` (accent bg), `ghost`. Sizes: `lg` 52px, `md` 44px (minimum touch target 44px).
- **Pill** shape. `primary`/`accent` may carry a **circle-arrow**: a 28px circle (white on ink, ink on accent), arrow icon 14px, 12px gap, 6px right inset.
- Hover: background shifts one step lighter/darker; the circle-arrow translates the arrow 2px right/up (transform only, 160ms ease-out). Pressed: scale .98. Disabled: 40% opacity, no pointer events. Loading: replace arrow with a spinner, keep width stable.

### 4.3 `Eyebrow`
`• LABEL` — a 6px dot (`--accent` on light cards, `--accent` or white on dark) + `eyebrow` type, `--ink-3` on light, `rgba(255,255,255,.6)` on dark. Positioned top-left or top-right of a card as in section-2. The dot is decorative (`aria-hidden`).

### 4.4 `AnnouncementBadge` (reference: Hero "New | Your Smart Finance Companion ›")
A small pill above the hero headline: an ink chip (`New` or a true status such as `Early access`) + short text + chevron. Height 32px, `small` type. Use only a **true** status. Links to a relevant anchor (e.g. industries). If there is nothing true to announce, omit it.

### 4.5 `TagPill` / `Chip`
Pill, 32px high, 1px `--line` border on light (or `rgba(255,255,255,.18)` on dark), 12px side padding, optional 16px leading icon, `small` type. Used for categories ("Shops", "Guest houses") and card tags.

### 4.6 `CircleButton`
44px circle (touch-safe), variants: outline (white, 1px line), ink, accent. Holds an icon (arrow, chevron, play). Used for prev/next, "go to" arrows, and slider controls. Hover: slight scale 1.04 plus arrow nudge. Always has an accessible name.

### 4.7 `InlineImageHeadline` (reference: section-2)
A headline where a small **image chip** (height ≈ 0.9× the line's x-height-to-cap span, width ≈ 2.2× height, `--r-pill`, 1px white inner ring) sits *between* words, vertically aligned to the text's optical centre.
- Rules: **max one chip per headline, max three on the whole page** (it is a signature, not wallpaper). Chip content must be **real imagery** — a crop of a real product screen, or an original/licensed photo — never emoji, 3D blobs, or stock cartoons.
- Accessibility: chip is decorative (`alt=""`, `aria-hidden`), so the headline reads cleanly as plain text.
- Responsive: on mobile the chip scales with the font size (`em` units) and may wrap with its neighbouring word via `white-space: nowrap` on the pair.

### 4.8 `StatCard` and `Counter`
- `Counter` (reference: "01 /8"): numeral token with `/N` in `--ink-3` at ~40% size, a small caption beneath ("Upcoming Event" → our own caption), and a pair of `CircleButton`s (outline prev, accent next). Used for the industries carousel (`01 /4`).
- `StatCard`: only for **true** figures (e.g. "4 industries", "14-day free trial", "KES 2,500/month"). No user counts until verifiable.

### 4.9 `GlassChip` (reference: section-1/2 image overlays)
A small label over imagery: `backdrop-filter: blur(12px)` over `rgba(255,255,255,.28)` with a 1px `rgba(255,255,255,.35)` border, white text, 28–32px high. **Fallback** when backdrop-filter is unsupported: solid `rgba(11,12,14,.55)`. Always sits on a scrim-protected area of the image so contrast holds.

### 4.10 `BentoGrid` and `BentoCard`
- 12-column grid; desktop gap 12–16px; tile spans defined per section (Section 5). Tiles are one of: **photo/UI tile**, **solid accent tile**, **ink tile**, **outline tile**, **text tile**. Mixed sizes, but every tile edge lands on a grid line.
- Tile anatomy: optional eyebrow, title (`h3`), description (`small`), optional action `CircleButton`. Photo tiles carry a bottom scrim (linear-gradient from `rgba(0,0,0,.55)` to transparent) when text overlays.
- Mobile: collapse to one column in a deliberate order (not source order by accident), full-width tiles, same gap.

### 4.11 `ListRows` (reference: section-2 "Current Events")
A vertical list inside an ink card. Each row: min-height 64px, title (`h3`), hairline `--line-dark` divider, right-aligned `↗` CircleButton-style icon. **Active row** = solid `--accent` pill spanning the row (radius `--r-pill`), text white, plus outline `TagPill`s; non-active rows are text on ink. Behaviour: hover or keyboard focus activates a row (150–200ms background transition; pill slides rather than blinks); on touch, tap activates. Implemented as an accessible disclosure/tab pattern (roving `tabindex`, `aria-selected`/`aria-expanded` as appropriate) — never a purely visual hover effect. Optionally paired with a `TiltedCard` on the right that swaps its image to match the active row.

### 4.12 `TiltedCard`
A rounded photo/UI card rotated 4–6° with `--e2`, overlapping the list's right edge and the card boundary. Desktop only (≥1024px); hidden on mobile. Rotation is static (no continuous animation); on active-row change it cross-fades.

### 4.13 `DeviceFrame` (reference: Hero phone)
Built in **CSS/SVG**, not a raster image: outer radius 44px, 10px bezel in `--ink`, inner screen radius 34px, a 92×26px dynamic-island pill at 10px from top, a subtle 1px lighter outline for edge definition. The screen holds a **real app screenshot** (AVIF/WebP, 2× resolution for the displayed size, explicit `width`/`height`). Bottom fade: `mask-image: linear-gradient(to bottom, #000 68%, transparent 100%)` on the device wrapper so it dissolves into the container, as in the reference. Add a tiny caption beneath or in the footer of the hero: **"Sample data"** (`eyebrow` size, `--ink-3`).

### 4.14 `FloatingUICard`
A white `--r-card` card, `--e2`, 20px padding, width 260–300px, holding a *real* UI fragment or concise text. Positioned absolutely on desktop relative to the device; on <1024px these become in-flow elements beneath the device (Section 5.2.6). No continuous bobbing; at most a 6px parallax on scroll, disabled for `prefers-reduced-motion`.

### 4.15 `PricingCard` (visual treatment for `hisaflow-landing-page.md` §3.9)
Solo: white card, outline button. **Team: ink card**, accent "Most popular" chip, accent-circle primary button. Growth: white card with outline, "Contact us" opening WhatsApp. Price in `numeral` token with `/month` in `small` `--ink-3`. Lead each card with its differentiator line, not a generic feature list.

### 4.16 `FAQRow`
Hairline-divided rows matching `ListRows` grammar on a light card: question (`h3`), plus/minus `CircleButton` at right, animated height via CSS grid-rows transition; one open at a time optional. Native `<details>`-based or ARIA-correct accordion; fully keyboard operable.

---

## 5. Section-by-section build specifications

Desktop figures assume a 1440px viewport; tablet 768–1023; mobile 360–767 (design target 390). Section order and content come from `hisaflow-landing-page.md` §3. The **rhythm** is:

`Hero (light mesh)` → `Problem (ink)` → `Industries (white + bento)` → `Features (white + UI)` → `How it works (ink list)` → `Demo (image/UI card)` → `Pricing (light, ink Team)` → `FAQ (white)` → `Final CTA (ink)` → `Footer (ink canvas)`

Each section is a rounded container on `--canvas`, gap 12–16px between containers.

### 5.1 Page frame
- `body` background `--canvas`. Cards column max 1360px, centered, outer margin per Section 3.3.
- The **hero container** carries the pastel mesh; every other container is flat `--surface` or `--ink`.
- Sticky nav is part of the hero container initially (floating inside it), and detaches to fixed on scroll without jumping.

### 5.2 Hero (reference: `Hero.jpg` — this must closely resemble it)

**5.2.1 Container.** `--r-section` radius, `--surface` base with a **soft mesh gradient**: two large radial gradients — `--mesh-a` anchored top-left (~10% 5%, radius ~45%) and `--mesh-b` anchored right (~90% 25%, radius ~40%), fading to `--surface`. Keep it **pastel and low-contrast** (as in the reference); no saturated blobs. Optionally overlay a barely visible organic line pattern at ≤4% opacity as SVG (the reference has faint swirl lines) — **optional**; omit if it risks weight or clutter. Min-height: `min(100svh - 32px, 900px)` desktop; auto on mobile.

**5.2.2 Content stack (all centered, in order, vertical rhythm 16/24/32):**
1. `FloatingNav` (inset 16px from top).
2. 48–64px gap, then `AnnouncementBadge` (true status only; else omit and keep the gap).
3. **Headline** (`display` token), 2 lines desktop, centered, `text-wrap: balance`, `--ink`. Direction: *"Run your shop, guest house or ISP from one app."* (final copy gets a human edit).
4. **Subheadline** (`body-lg`, `--ink-2`, max 44ch, centered): who it's for and how it works in two short lines.
5. **CTA pair, centered, 12px apart:** `primary lg` "Start free trial" with circle-arrow → sign-up; `secondary lg` "See how it works" → anchors to the industries/features section (reference has "Explore Features"). Under the pair, microcopy (`small`, `--ink-3`): "14-day free trial · No card needed."
6. 48px gap, then the **device cluster** (Section 5.2.3).
7. Bottom: **"Built for" row** (Section 1.3), centered caption "Built for Kenyan businesses of every size" + the icon-text row, 24px above the container bottom padding.

**5.2.3 Device cluster (desktop ≥1024).** `DeviceFrame` centered horizontally, width **~300px** (screen 280px), partially overlapping the container's lower region and fading out via the mask (Section 4.13). Two `FloatingUICard`s flank it at **staggered heights** (as in the reference): left card's top ≈ 32% down the visible device, right card's top ≈ 18% (they must not align horizontally; the stagger is the point). Each card overlaps the device edge by ~24px and sits at `z-index` above the device or tucked partially behind (choose one consistently). Card widths ~280px; gap to device ≥ 24px after overlap. The cluster's total width stays within the 1360px column with ≥ 40px side clearance.

**5.2.4 What the phone screen shows.** An **actual screenshot** of the app's home/dashboard from a seeded demo organization (a duka). It must show only **shipped** features. Seed realistic Kenyan data whose arithmetic is **internally consistent** — e.g. *Today's sales* **KES 48,350**, split **M-Pesa 31,250 · Cash 12,800 · Card 4,300** (sums to 48,350); donut percentages **65% · 26% · 9%** (sums to 100%). Item names plausible for a duka (unga, sugar, cooking oil, airtime). If a figure appears, it must reconcile with every other figure on that screen — "numbers that don't add up" is the most common tell of a fake dashboard. Capture at 390×844 @2×; export AVIF with WebP fallback. The status bar in the screenshot shows a plausible time and full signal/battery (set in the capture, not edited in post).

**5.2.5 Floating card content (replaces the reference's trust slots).**
- *Left* (feature): small icon chip + `h3` "Pay by M-Pesa, matched to the sale" + `small` one-line description + three small industry `TagPill`s. Gated by the M-Pesa claims flag; fallback copy "Built in Kenya, for Kenyan businesses."
- *Right* (founder note, **only if supplied by the owner**): one sentence in `h3`-sized text, then name and role in `small`. **If not supplied, omit it** and instead shift the left card to the left of the device and let the cluster stay balanced with a single card plus a "Sample data" caption on the right. Never fill this slot with an invented quote or star rating.

**5.2.6 Tablet / mobile.**
- **<1024px:** the floating cards leave the absolute layout. The device stays centered (width 240–260px on mobile) with the same bottom fade; the cards flow **below** it as a horizontal **scroll-snap row** (card width 80% of viewport, 12px gap, snap-start) or a single column if only one card exists. The "Built for" row wraps to two lines, centered.
- **Mobile nav:** capsule with logo + 44px menu circle; CTA row stacks full-width (primary above secondary), each 52px high.
- Headline mobile: 3 lines max; verify no orphan words (`text-wrap: balance`).

**5.2.7 Entrance motion (hero only).** Staggered fade-up of badge → headline → sub → CTAs → device (each 8–12px translate, 500ms, 60ms stagger), device rises 24px with the fade. Run once, CSS-driven, no JS animation library. Disabled under `prefers-reduced-motion`. LCP element is the headline text or the device screenshot — whichever is the LCP candidate must be `priority`/preloaded and must **not** wait on the animation to be visible to meet the performance budget (opacity transitions must not delay LCP — start from `opacity: 1` for the LCP element or use transform-only animation on it).

### 5.3 Problem (dark card) — maps to §3.4 (reference grammar: section-2 black card, large type)
- Ink container, `--r-section`, padding 40/64px desktop.
- Left (7 cols): `Eyebrow` "• THE PROBLEM", a large `h2` in white stating the pain in the owner's terms (stock in a notebook, M-Pesa messages matched by hand, bookings in WhatsApp, customers cut off manually). One `InlineImageHeadline` chip allowed here (real crop of a notebook-vs-app comparison is *not* required; a real product crop is fine).
- Right (5 cols): 3–4 **one-line pain statements** as hairline-divided rows (non-interactive here), each preceded by a small number `01–04` in `--ink-3`. Below, one sentence of resolution in `--accent`-underlined or white `body-lg`.
- Mobile: single column; rows stay.

### 5.4 Industries (reference: `section-1.jpg` Services panel + section-2 counter)
- Light container on `--canvas`; **two-column** panel at ≥1024px.
- Left (5 cols): `Eyebrow` "• INDUSTRIES", `h2` "Built for how your business actually works", `small` paragraph, **accent button** "Start free trial", and a row of 4–5 circular icon buttons for the verticals (outline `CircleButton`s with tooltips = vertical names; keyboard-accessible; they scroll/select the matching tile).
- Right (7 cols): **2×2 bento** — Shops, Guest houses, ISPs, Schools. Tile styling mirrors the reference mix: **one UI/photo tile, one solid-accent tile, one outline tile, one ink tile**, assigned so the accent tile is the vertical with the strongest current product (owner decision at build). Each tile: vertical name (`h3`), **one pain → one outcome** line, a `↗` `CircleButton` linking to the vertical page (L-F) or an in-page detail; "Coming soon" tiles get a `TagPill` and a disabled-looking-but-readable treatment, never a dead link.
- Photo tiles use original/licensed Kenyan-context imagery (duka counter, reception desk, network cabinet, classroom admin) **or** a real product UI crop. **If imagery is unavailable at build time, ship UI-crop tiles only** — the layout must not depend on photography.
- Counter: on <1024px the 2×2 becomes a **scroll-snap carousel** with `Counter` (`01 /4`) and prev/next `CircleButton`s above the track (no carousel library; CSS scroll-snap + a few lines to update the counter and buttons).

### 5.5 Features as benefits (reference: `section-2.jpg` card 2)
- White container, 2-column. **Left:** a large rounded media tile (`--r-card`) containing a **real UI screenshot** with a `FloatingUICard` overlapping it (e.g. a stock-alert or daily-sales card built from real UI) — mirrors the "Activity" card over the photo. **Right:** `Eyebrow` "• FEATURED", `h2` with one `InlineImageHeadline` chip ("Know what's in [chip] stock before it runs out"), a row of 4 small circular icon buttons + "+N" accent chip summarizing further features, a `small` caption, and a large accent circular `↗` `CircleButton` ("Explore all features" → anchors to a features detail or sign-up).
- Beneath: a **bento of 3 outcome tiles** (stock alerts, receipts, finance view; tax tile **claims-gated**, labeled "Coming soon" if the tax system isn't live). Each tile = one benefit sentence + one UI crop. No icon-tile soup; the UI crop *is* the visual.
- A small secondary image tile with a `GlassChip` ("Coming soon" label etc.) is allowed **only for features genuinely labeled as upcoming**.

### 5.6 How it works (reference: `section-2.jpg` card 3 list)
- Ink container with `Eyebrow` "• HOW IT WORKS", an `h2` (one chip allowed, max-three-per-page budget counted), and a `ListRows` of **three rows** that mirror the *real* onboarding: **Create your account** · **Tell us your business type** · **Record your first sale**. Active row = accent pill with two outline `TagPill`s (e.g. "2 minutes", "No card needed") — only true statements.
- Right side (desktop): a `TiltedCard` showing the real screenshot of the corresponding onboarding step; swaps on active row.
- Default active row: row 1; auto-advance is **not** allowed (no autoplay); activation is by hover/focus/tap only.
- Mobile: rows stack full-width; the tilted card is hidden; each row expands inline to show its screenshot (accordion pattern).

### 5.7 Product demo
- Large `--r-card` media card in a white container: a real 60–90s screen recording, poster-first (poster image only on load; video loads on tap). Centered `CircleButton` play (64px, ink) with a `GlassChip` caption ("Watch: a day in a duka · 1:20"). No autoplay, no audio on load, captions provided. If no video exists yet, **omit the section** rather than ship a placeholder.

### 5.8 Pricing (reference grammar: section-1 bento + section-2 cards)
- Light container, `Eyebrow` "• PRICING", `h2`, then three `PricingCard`s in a **12-col grid: 4/4/4**, with Team slightly taller (+16px) via negative margin to read as "recommended" while staying on the grid. Under the cards: trial microcopy and accepted payment methods (text/icons per brand guidelines).
- Mobile: stacked in order **Team, Solo, Growth** (recommended first), or swipeable snap row; decision recorded in tracker.
- Data comes from the shared plan source (`hisaflow-landing-page.md` §5.3) — **no hardcoded values**.

### 5.9 FAQ
- White container, 2-column at ≥1024px: left `Eyebrow` + `h2` + a WhatsApp `CircleButton`/text "Still unsure? Ask us on WhatsApp"; right `FAQRow`s (eight questions per `hisaflow-landing-page.md` §3.10). Mobile single column.

### 5.10 Testimonials (staged — reference: `section-2.jpg` card 4)
- **Render only when real, approved testimonials exist.** Until then: omit the section entirely (the founder note in the hero is the only personal voice). When real: layout per the reference — headline with chip, two testimonial cards of differing widths (one white, one tinted with a date/role chip), partially cropped bleed at the edge on desktop to hint scrollability (as in the reference), scroll-snap on mobile. Each testimonial: real name, business, location, one specific outcome, written consent recorded.

### 5.11 Final CTA
- Ink container, centered: `h2` (white), one `small` line, `accent` `Button lg` "Start free trial" + `secondary` (white-outline) "Chat on WhatsApp". Subtle accent radial glow is **not** allowed; use a flat ink background with a faint 4% grid/dot texture at most (optional).

### 5.12 Footer (reference: `section-1.jpg` bottom columns)
- On `--ink` canvas continuing from the final CTA (or its own ink container). Four columns of short link groups (Product, Industries, Company, Legal) in `small`/`--ink-3` with `--ink`→white hover, hairline divider, then micro-line with © and company details, with Privacy Policy and Terms links. Mobile: two columns then one.

---

## 6. Motion & interaction rules

- **Principle:** motion communicates state or hierarchy; nothing moves for decoration.
- **Tokens:** `--dur-fast: 150ms`, `--dur-base: 220ms`, `--dur-slow: 500ms`; easing `cubic-bezier(.2,.8,.2,1)` (ease-out) for entrances and hovers.
- **Allowed:** one-time entrance fade/translate on first scroll into view (CSS + `IntersectionObserver`, `translateY(12px)`→0, `opacity .0→1`, once only); hover/focus transitions on buttons, rows, tiles; accordion height transitions; the active-row pill slide.
- **Not allowed:** autoplaying carousels or video, infinite marquees/bobbing, scroll-jacking, parallax on more than the hero cards (max 6px), cursor-follow effects, large Lottie/WebGL.
- `prefers-reduced-motion: reduce` removes translate/parallax and keeps only opacity/colour changes.
- Animate **only `transform` and `opacity`**; never animate layout properties. No animation library unless it's justified against the 1.5MB budget in writing (CSS-first is the default).

---

## 7. Imagery, content, and data rules

1. **Photography:** original or properly licensed images reflecting real Kenyan contexts (duka counters, guest-house reception, ISP cabinets/towers, school admin), with subject consent and written licence on file. No generic Western stock office photos. No AI-generated people.
2. **Graceful degradation:** every photo slot has a UI-crop or solid-colour fallback so the page is complete and attractive **without** any photography. The build must not fail visually if photos aren't ready.
3. **Product UI imagery:** real screenshots from a seeded **demo organization** in a staging environment; seeded data is realistic and **arithmetically consistent** (Section 5.2.4); consistent device status-bar settings; no personal or customer data ever.
4. **Formats:** AVIF with WebP fallback via the framework's image component; explicit `width`/`height`; `sizes` attributes; `priority` only for the LCP image; everything else lazy. Strip metadata.
5. **Copy:** specific, short, local; no filler superlatives; consistent terms (Solo, Team, Growth; "trial", not "demo"); KES formatted `KES 2,500`; en dash for ranges; no emoji in UI copy.
6. **Placeholders:** a build-time check fails the build if any placeholder token (e.g. `TODO`, `lorem`, `PLACEHOLDER`, `{{ }}`) or any reference-image text appears in rendered output.
7. **Claims:** every capability claim is bound to a claims flag (`hisaflow-landing-page.md` §6).

---

## 8. Responsive behaviour

| Breakpoint | Layout notes |
|---|---|
| 360–479 | Single column; nav capsule + menu; device 240px; floating cards in snap row; bento = 1 col; list rows stacked |
| 480–767 | Same as above; device 260px; 2-col only for small chip rows |
| 768–1023 | Two-column sections where it reads well (Industries, Features); bento 2 col; floating cards still in-flow below device |
| 1024–1279 | Full desktop grid; floating cards absolute around the device; tilted card appears |
| 1280–1535 | Target desktop (design at 1440); card column max 1360 |
| ≥1536 | Column stays 1360px centered; canvas margins grow; type tokens cap at their max |

Test explicitly at 360, 390, 768, 1024, 1280, 1440, 1920. No horizontal scroll at any width. Touch targets ≥ 44×44px. Hover-only affordances must have focus and tap equivalents.

---

## 9. Performance & accessibility gates

- **Budget (hard gates):** LCP ≤ 2.5s on throttled 4G mobile; initial page weight ≈ ≤ 1.5MB; CLS ≈ 0; INP good. Self-hosted font subset, with only the weights actually used. Server-render/statically generate the page; client JS limited to islands (mobile menu, list rows, carousel, accordion, analytics).
- **Image discipline:** one hero device screenshot + a bounded number of lazy tiles; total image bytes budgeted per section in the PR description.
- **A11y:** semantic landmarks (`header`, `nav`, `main`, `section` with headings, `footer`); logical heading order (one `h1`); focus-visible rings on every interactive element; skip-to-content link; contrast AA verified for each token pair and for text over any image (scrim); `alt` text on all informative images, `alt=""` on decorative chips; accordions/list rows with correct ARIA and keyboard support; `prefers-reduced-motion` honored; no information conveyed by colour alone; video has captions.
- **Run** Lighthouse (mobile) and an automated accessibility check (e.g. axe) in CI if the repo's tooling allows; otherwise record manual results in the PR.

---

## 10. Implementation guidance (technical)

1. **Inspect first, then conform.** Read the existing frontend (framework version, styling system — Tailwind, CSS Modules, or other —, component conventions, icon library, font setup, `next.config`, middleware). Reuse what exists. Do not introduce a second styling system, icon set, or animation library without a written justification.
2. **Routing & layout.** Landing lives in its own route group/layout (e.g. a `(marketing)` group) separate from the authenticated dashboard layout so dashboard styles/scripts never load on the landing page (and vice versa). Public-route config for the auth middleware per `hisaflow-landing-page.md` §5.1 — verify the current API in the installed version.
3. **Components.** Place under a dedicated marketing components directory; one file per component in Section 4; props typed; no business logic inside presentational components; data (plans, claims flags, copy) injected from a typed config.
4. **Server vs client.** Default to server components; mark only interactive islands as client components (`FloatingNav` mobile menu, `ListRows`, `Counter`/carousel, `FAQRow`, analytics).
5. **Tokens.** A single `tokens` source (CSS variables / theme extension). Lint rule or review check: no raw hex, no raw `px` radius, no ad-hoc shadows in component files.
6. **Content config.** All copy, claims flags, and plan data in typed config modules so human copy edits don't touch components.
7. **Images.** Use the framework's image component; store screenshots under a versioned assets directory with a README listing how each was captured (seeded demo org, device size, date).
8. **Testing.** Unit tests for the carousel/counter logic, claims-flag gating, and the placeholder-ban check; component tests for keyboard behaviour (menu, list rows, FAQ); visual regression screenshots at the Section 8 widths if a visual-testing tool already exists in the repo (do not add heavyweight tooling without sign-off).
9. **Regression safety.** The existing sign-in, sign-up, onboarding, and dashboard flows must behave identically; explicitly test them after landing routes are added.

---

## 11. Visual QA protocol (what "matches the references" means)

A reviewer compares the build to the references at 1440px and 390px. A section passes when:
- **Grammar match:** it uses the same component grammar as its reference (capsule nav, pill+circle-arrow buttons, eyebrow labels, inset rounded cards, bento mix) — checked against Section 1.1.
- **Proportion match:** container radius, gutters, headline-to-sub-to-CTA spacing, and device-to-card staggering are visually close to the reference (tolerance: spacing within ±4px of the token scale; radii exactly from tokens).
- **No forbidden copy:** no reference text, brands, imagery; no invented trust signals (Sections 1.2–1.3).
- **Engineered checklist** (Section 2.2) passes: tokens only, real UI, consistent numbers, one accent, restrained motion.
- **Gates pass:** performance, accessibility, no layout shift, no horizontal scroll, claims flags correct.
Record before/after screenshots at the Section 8 widths in the PR.

---

## 12. Layered build briefs for the agents

Each prompt assumes the agent has read: `hisaflow-landing-page.md`, this doc, and `hisaflow-agent-build-briefs.md` Part 1; has the three reference images at `docs/design-references/`; and will update the trackers when done. Issue **in order**; each assumes the previous is merged. The landing work is frontend-heavy; backend involvement is limited to the plan-data endpoint and plan-intent storage already scoped in `hisaflow-landing-page.md`.

### Layer V-1 — Foundations: tokens, typography, primitives
> Objective: implement Sections 3 and 4.2, 4.3, 4.5, 4.6, 4.9 and the shared layout frame (5.1). Inspect the existing frontend styling system first and conform to it. Deliver: tokens (colour, radius, spacing, elevation, type scale), self-hosted font setup, the page frame/route-group layout, `Button`, `Eyebrow`, `TagPill`, `CircleButton`, `GlassChip`, and a throwaway-free **internal component gallery route** (non-public, excluded from sitemap/production if the repo supports it) showing every variant/state. Do not build page sections yet. Done when: tokens are the only source of values (a lint/grep check shows no raw hex/radius/shadow in components); AA contrast verified for every token pair; keyboard and focus behaviour verified; existing sign-in/sign-up/onboarding/dashboard unchanged; lint, types, tests, CI green; tracker updated.

### Layer V-2 — Navigation and Hero
> Objective: build `FloatingNav` (4.1), `AnnouncementBadge` (4.4), `DeviceFrame` (4.13), `FloatingUICard` (4.14) and the full Hero (5.2) to closely resemble `Hero.jpg` using HisaFlow content and the honest-slot rules in Section 1.3. Prerequisite: a real screenshot of the app dashboard from a seeded demo org whose numbers reconcile (5.2.4) — if it doesn't exist, **stop and report**; do not fabricate a screenshot or numbers. Honor the claims flags and the founder-note-only-if-supplied rule. Done when: hero matches the reference grammar and proportions at 1440 and 390; mobile menu is fully accessible; LCP element loads under budget and is not delayed by entrance animation; no horizontal scroll at any tested width; reduced-motion respected; no forbidden/invented content; gates in Section 9 pass; tracker updated.

### Layer V-3 — Problem, Industries, Features
> Objective: build Sections 5.3, 5.4, 5.5 and the components they need (`InlineImageHeadline` 4.7, `Counter` 4.8, `BentoGrid`/`BentoCard` 4.10), following `section-1.jpg` (services panel + bento) and `section-2.jpg` (card 1 counter, card 2 media + floating UI). Photo slots must degrade to UI crops (Section 7.2). Respect the max-three inline-chip rule across the page. Done when: sections match reference grammar; bento tiles align to grid lines; carousel (mobile) is CSS scroll-snap with working counter and buttons and no library; verticals not live are labeled "Coming soon" with no dead links; QA protocol (Section 11) passes; gates pass; tracker updated.

### Layer V-4 — How it works, Demo, Footer shell
> Objective: build 5.6 (`ListRows` 4.11, `TiltedCard` 4.12), 5.7 (demo — omit if no video exists), and the footer (5.12). `ListRows` must be an accessible pattern with roving focus; no autoplay or auto-advance. Rows must mirror the **real** onboarding steps — verify against the actual flow. Done when: keyboard and touch both operate the list; screenshots in the tilted card match real onboarding screens; demo respects poster-first loading and the budget (or is omitted); gates pass; tracker updated.

### Layer V-5 — Pricing, FAQ, Final CTA, (Testimonials if real)
> Objective: build 5.8–5.11 with `PricingCard` (4.15) and `FAQRow` (4.16). Pricing data must come from the shared plan source (no hardcoded prices); CTA behaviour per `hisaflow-landing-page.md` §1 (sign-up with `?plan=`; Growth → WhatsApp). FAQ answers must be verified true against shipped behavior. Testimonials render only with real approved content, otherwise the section is omitted. Done when: changing a plan value updates landing and paywall identically (test proves it); FAQ is fully keyboard-operable; gates and QA protocol pass; tracker updated.

### Layer V-6 — Polish, motion, performance pass
> Objective: add the restrained motion in Section 6 (entrance reveals, hover states, active-row slide) and run the full performance/accessibility pass. Do not add features or sections. Done when: every animation animates only transform/opacity and respects reduced-motion; Lighthouse mobile and axe results meet Section 9 budgets and are recorded in the PR; before/after screenshots at all Section 8 widths attached; the placeholder-ban and claims-flag checks run in CI; tracker updated.

---

## 13. Progress tracker

| Layer | Scope | Status | Notes |
|---|---|---|---|
| V-1 | Tokens, typography, primitives, frame | ✅ Done (2026-10-06) | Tokens live in `app/globals.css`; core app colours are the primary palette (green accent, core ink/canvas), the spec's warm `#FF5A1F` is retained as a tertiary "Coming soon" status token, and pastel mesh colours come from the spec. Primitives under `components/marketing/` and an internal `/gallery` route (404 in production, excluded from the sitemap). No raw hex/radius/shadow in section components (values come from tokens). |
| V-2 | Nav + Hero | ✅ Done (2026-10-07) | Floating capsule nav uses the real HisaFlow mark (`public/icons/hisaflow-mark.png`, cropped from the supplied `icon-512.png`). Full-bleed mesh hero (no inset card). Device faces slightly right (`rotateY(14deg)`) so the shiny metallic left edge is visible; thick black body, inner metallic/grey bezel stroke, soft diffuse shadow, and an `overflow-hidden` 38px-radius screen. The cutout is now a centred pill inside a status bar (`9:41` + signal/wifi/battery) with the app capture (`public/images/marketing/phone-app.png`, `object-cover object-top`) starting below it, and a `60%` to `100%` bottom mask fade dissolves the casing into the canvas. Capability card holds the interlaced icon circles (M-Pesa / KRA / Card) with 2px white borders, `-12px` overlaps and palette colours from Section 3.1 (green / blue / warm); copy updates on click and auto-advance. Right-hand AI card covers data ingestion and tracking. Founder-note slot omitted as not supplied. A 2026-10-09 correction pass removed both card eyebrows (`Built in`, `HisaFlow AI`), rebuilt the three interlaced capability circles as dimensional buttons (gradient fill, specular highlight, inset bevel, drop shadow), padded the announcement badge, darkened the built-for row, and removed the device drop shadow so no grey halo sits behind the phone. A 2026-10-09 pass gives the hero a phone-centred tablet layout with the capability and AI cards side by side at `md`. |
| V-3 | Problem, Industries, Features | ✅ Done (2026-10-07) | **Problem** follows `section-1.jpg` and is a rounded 32px container in the hero's `--mesh-b` light blue, inset 8px/16px so the corners read against the canvas (no floating white card). The 2×2 bento is arranged in two balanced flex columns so the two imagery tiles (stock, bookings) can be tall (`min-h-[340px]`, richer coded UI backgrounds) with a **compact** `mk-glass-panel` frosted caption (image fills the tile, words on top), while the two solid tiles keep their natural size: solid green (payments, with chips) and solid accent-blue (tax, with a colour-safe warm footer tab). **Industries and Features were then rebuilt (2026-10-07) to `section-2.jpg`** (see the section-2 correction entries in the action log): Industries is now the reference's carousel block (counter with prev/next, ink feature card, coded visual card with two floating metric tags) and Features is the activity block (centred floating analytics card over a coded dashboard, inline-chip headline, icon pills, accent CTA, coming-soon preview, three outcome tiles). Photo slots degrade to coded UI crops. A 2026-10-08 pass scoped the reference's bright orange (`#FF4500` via `--mk-ref-accent`) to these three sections and refined proportions/details (see the colour/detail pass entry). A 2026-10-09 pass removed the industry pills, darkened the intro, made the `Encircled` marker scroll-linked, and replaced the static Features preview with the looping `FeatureScanAnimation`. A 2026-10-09 pass gives Industries a full-width counter row plus side-by-side feature/visual cards at `md`, and Features its two-column media/text split at `md`. A 2026-10-09 mobile pass leads Features with the copy and stretches the Voice input card edge-to-edge on mobile. |
| V-4 | How it works, Demo, Footer | ✅ Done (2026-10-07) | `HowItWorks` was rebuilt to the third block of `section-2.jpg`: eyebrow + inline-chip headline + intro, list rows with accent active banner and `onAccent` chips, and a rotated white step card that **overlaps** the list on desktop (mobile keeps the inline accordion). Demo section omitted (no recording); semantic `<footer>` with four link columns. No autoplay. A 2026-10-09 pass made the desktop step card reveal on scroll/interaction, cross-fade the step swap, and round the active orange banner. A 2026-10-09 pass replaced the mobile/tablet inline accordion with a single widget and made the active step scroll-driven (advances/retracts as rows cross the focus line). |
| V-5 | Pricing, FAQ, Final CTA, Testimonials | ✅ Done (2026-10-06) | Three pricing cards (Team ink/recommended/raised), FAQ accordion, ink final CTA. Testimonials omitted until real. Pricing reads `lib/plans.ts`; Growth → WhatsApp. Fixed a claims-policy violation where the Solo bullet claimed live eTIMS filing. A 2026-10-09 pass corrected the mobile order to Solo, Team, Growth. |
| V-6 | Motion + performance/accessibility pass | 🟡 In progress | Reduced-motion login in `globals.css`; transitions limited to transform/opacity/colour; semantic landmarks, skip link, focus rings, ARIA on menu/accordion/carousel and AA contrast verified for the token pairs. Remaining: add the hero entrance stagger (Section 5.2.7) without delaying LCP, and run Lighthouse mobile + axe and record results in the PR. The `Reveal` fade-up now covers every content section except the footer, and deliberate `md` tablet layouts were added to the hero, Industries and Features. |

### Action log

- **2026-10-06** — Reviewed all three references and the rendered page at 1440/1024/390. Confirmed the Industries section is the `section-1.jpg` white middle panel target.
- **2026-10-06** — Replaced the doc-default accent with the core app green as the single primary accent; added `#FF5A1F` only as a tertiary status token, so the brand stays consistent with the app while the spec colours remain present.
- **2026-10-06** — Fixed AA contrast (`--mk-ink-3` → core `#6B7280`; accent-tile pain line to 90% white), made the footer semantic, added the internal gallery, and added placeholder-ban + component tests.
- **2026-10-06** — Balanced the hero (`max-w-4xl` headline, Sample-data caption aligned to the floating card) after visual QA.
- **2026-10-07** — Hero revision per owner review: made the mesh full-bleed, angled the device and added physical/glass detail, filled the screen with the supplied `Phone-app-pic.png`, replaced the side card with an interactive interlaced capability rail plus an AI card, and switched the nav to the real logo mark.
- **2026-10-07** — Second hero pass: device returned to a straight-on pose with a black/metal-stroke frame, soft diffuse shadow, clipped 38px screen radius, pill island and a 60%→100% bottom mask fade; the capability card now contains the avatar-stack circles (2px white borders, -12px overlap, accent ring on active).
- **2026-10-07** — Third hero pass: device turned slightly right (`rotateY(14deg)`) with a shiny metal left rail; a status bar now sits above the app content so the pill no longer disrupts it, and the image starts below it; the interlaced circles take palette colours from Section 3.1 (M-Pesa green, KRA blue, Card warm) with solid fills on the active circle.
- **2026-10-07** — Problem section rebuilt to `section-1.jpg`: full-bleed dark band, floating white card with a 2-column layout, and a 2×2 bento of problem→solution tiles with mixed tones; hero and problem now flow edge-to-edge with no gap.
- **2026-10-07** — Problem follow-up: the container is now the hero's `--mesh-b` light blue spanning end-to-end (white card removed); the four bento tiles each take a distinct colour (white / green / accent-blue / ink); the eyebrow dot is gone and two hand-drawn pen strokes underline its last word.
- **2026-10-07** — Problem follow-up 2: the blue container corners are rounded (32px, 8/16px inset); the two imagery tiles now fill the whole tile with the coded UI and carry their copy on a `mk-glass-panel` frosted overlay (image behind, words on top) rather than image-above-text.
- **2026-10-07** — Problem follow-up 3: imagery tiles made taller (`min-h-[340px]`) with richer coded UI backgrounds and a compact glass caption; the bento is now two balanced flex columns so the solid green/blue tiles keep their own size.
- **2026-10-07** — Removed every em dash from landing copy and metadata (reworded in place) and added an em-dash ban to `lib/placeholder-ban.spec.ts` so it cannot regress.
- **2026-10-07** — Section-2 correction, layer 1 (Industries): rebuilt the section to the first block of `section-2.jpg` as an interactive carousel. Header row now pairs inline vertical labels (Shops & dukas, Guest houses, ISPs, Schools) on the left with the `• INDUSTRIES` eyebrow on the right; the headline carries a single inline icon chip before "business actually works". The three-column grid is a bordered counter card (`01 /4` plus prev/next `CircleButton`s, the next one accent), an ink feature card with the active vertical's outcome, pain, an interlaced icon stack and a Live dot/tag, and a coded-UI visual card with two `GlassChip` overlays. The old 2×2 bento and mobile `SnapCarousel` are no longer used by this section; the shared `SnapCarousel` primitive and its tests remain. The single brand accent stays core green (reference orange mapped to the accent token). Typecheck, lint and the marketing tests are green.
- **2026-10-07** — Section-2 correction, layer 2 (Features): rebuilt the section to the second block of `section-2.jpg`. Left is now a tall coded dashboard with a white Analytics card (`KES 48,350`, split 31,250 / 12,800 / 4,300 across M-Pesa, cash and card) centred over it via absolute positioning, including a sparkline and three category columns. Right stacks the `• FEATURED FEATURES` eyebrow, the inline-chip headline, sub-text, a row of four labelled icon pills plus an accent `+2`, the accent circular CTA, and a small "eTIMS filing · Coming soon" preview card. The lower bento is now three outcome tiles (stock, receipts, finance); the eTIMS claim moved to the preview card so it stays honestly labelled. Eyebrow copy is now "Featured features". Typecheck, lint and the marketing tests are green.
- **2026-10-07** — Section-2 correction, layer 3 (How it works): rebuilt the section to the third block of `section-2.jpg`. The ink card now has an eyebrow, an inline-chip headline ("From sign-up to your first [sale] in minutes") and a short intro paragraph in the header. The interactive list keeps roving hover/focus/tap activation and the accent active banner, with chips restyled for the accent background (`TagPill tone="onAccent"`). On desktop the rotated white step card now overlaps the right side of the list rows (`absolute`, `z-20`, `pointer-events-none`, `lg:pr-[38%]` on row content) instead of sitting in its own column; the mobile inline accordion is unchanged. `HOW_IT_WORKS` copy is now split before/chip/after. Typecheck, lint and the marketing tests are green.
- **2026-10-07** — Section-2 correction, full gate: added component tests for the reworked sections (`Industries.spec.tsx` proves the `01 /4` counter, next/prev bounds and icon-stack selection; `HowItWorks.spec.tsx` proves the row disclosure and the three real onboarding steps). Frontend `tsc`, `next lint`, the full frontend test suite (92 tests, 17 files) and `next build` all pass. Deliberately **not** adding full-viewport scroll snapping: Section 6 forbids scroll-jacking, the sections are variable-height (so mandatory snap would fight normal reading) and GSAP is not installed (and would breach the no-animation-library and 1.5MB budgets). A non-hijacking `scroll-snap-type: y proximity` can be added on request if the owner wants the reference's "snapped" feel.
- **2026-10-08** — Section-2 correction, colour/detail pass against the owner's text description. Added `--mk-ref-accent` (`#FF4500`), `--mk-ref-accent-hover` and `--mk-ref-accent-ink`, scoped to the three sections with `.mk-ref` so the rest of the page keeps the core brand accent; added `.mk-float-panel` (soft 30px shadow + `rgba(255,255,255,.2)` hairline) for the floating cards. **Industries:** header labels became bordered pills, the grid moved to the reference's `1fr 1.5fr 1.5fr`, the coded visual card lost its colliding list overlay and now carries two `GlassChip` metric tags with professional icons (`BellRing`/`PackageCheck`, `CalendarDays`/`LogIn`, `Router`/`RefreshCw`, `Wallet`/`Users`), and the live dot became a `Radio` indicator. **Features:** reordered to the reference (eyebrow, headline, icon pills, sub-text, CTA, coming-soon preview) and gave the floating analytics card the depth treatment. **How it works:** the active banner is the reference orange, the arrow now sits at the far right of the row, the overlapping step card moved inboard so it no longer covers the arrow, and the active description uses full white for contrast. Added a desktop-only, reduced-motion-aware `scroll-snap-type: y proximity` on the inset card stack (non-hijacking; wheel, keyboard and variable-height sections are unaffected). Typecheck, lint, 92 tests, build and a 1440/768/390 render check (0px horizontal overflow) all pass.
- **2026-10-08** — Section-2 owner review pass 2. **Industries:** the card background is now full-bleed while keeping its 32px radius; the counter caption is "Vertical specific" with the word "specific" hand-encircled; the eyebrow lost its leading dot; the headline circles "actually"; the inline store icon became a coloured dimensional green badge; and the CTA plus next arrow reverted to the core brand green via `.mk-core-accent`. **Features:** copy was rewritten around the shipped AI and scanning story (barcode lookup, label OCR, receipt capture, plain-language AI ingestion, voice as an honest coming-soon) with a coded camera-viewfinder media panel and new barcode/label/receipt tile crops; the section is now full-bleed with square edges and a quiet palette mesh (`.mk-mesh-features`). `Section` gained a `contentClassName` prop so a full-bleed background can hold a centred content column. Typecheck, lint, 92 tests, build and 1440/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Section-2 owner review pass 3. The "Vertical specific" label moved to the Industries eyebrow (with "specific" marker-encircled after the dot was removed) and the counter caption was deleted entirely. The hand-drawn accent became a deliberate marker loop (tighter bounds, 2.8px headline / 2px eyebrow strokes, start/end overshoot) that clears the letters without touching adjacent words. Features eyebrow is "Hustle free"; the CTA reads "Streamline your process" and is back on the core green; the inline AI chip is a roomier bubble. Typecheck, lint, 92 tests, build and 1440/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Section-2 owner review pass 4. The marker accent is now painted behind the text (`isolate` + negative z-index) and padded further on both "specific" and "actually", so the glyphs are never crossed. The "Hustle free" eyebrow lost its dot. Added a subtle `--mk-e1` lift to the Industries section card and a subtle warm `--mk-e-accent` shadow under the three AI/scanning feature tiles. Typecheck, lint, 92 tests, build and 1440/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Hero-to-Problem transition pass. The Problem section became a full-bleed band (rounded corners and side margins removed) with a top fade that blends the hero's white base into `--mk-mesh-b` plus a soft green radial continuing the hero's bottom glow, making the boundary seamless. The Features (`Hustle free`) section got a matching soft top fade and smokey white glow over its pastel mesh. The `specific` eyebrow encircling was padded further via a new `sizeClassName` hook on `Encircled`. Typecheck, lint, 92 tests, build and 1440 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Layout pass 6. Every section eyebrow was removed from the rendered page (Problem, Industries "Vertical specific", Features "Hustle free", How it works, Pricing, FAQ); the `Eyebrow` primitive remains only on the internal gallery route. How it works is now full-bleed with rounded corners, Pricing full-bleed square, FAQ full-bleed rounded, and the Footer full-bleed square with a new darker `--mk-mesh-ink-*` mesh gradient. Typecheck, lint, 92 tests, build and 1440 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Hero pass 7. Replaced the device's protruding metallic side rail (which read as the phone's back and reversed its orientation) with a flush metal glint. The hero background fades into the canvas at the bottom, the Problem band's top fade starts from the same canvas colour, and the hero/problem padding was tightened so the fade bridges them without a hard white gap. Added a restrained scroll parallax to the phone (`Parallax.tsx`: rAF, transform-only, 48px cap, reduced-motion aware) with extra room above the built-for row so the lag never collides with it. Typecheck, lint, 92 tests, build and render checks (0px horizontal overflow) all pass.
- **2026-10-09** — Hero/problem correction pass (owner review). Removed the `Built in` eyebrow from the capability card and the `HisaFlow AI` eyebrow from the AI card (the `HERO_AI.eyebrow` config field is gone). Rebuilt the three interlaced capability circles as dimensional buttons: per-capability top-light/bottom-dark gradients, a specular highlight, inset bevel highlights and a drop shadow, with saturated active fills and soft idle tints. Increased the `AnnouncementBadge` padding (`h-10`, roomier chip). Darkened the `Built for Kenyan businesses of every size` caption and its vertical icons to `--mk-ink-2`. Removed the device's heavy drop shadow so no grey halo shows behind the phone. Added a bottom fade to the Problem band (`.mk-problem`) so its lower edge dissolves into the canvas. Typecheck, lint, 92 tests, production build and 360/390/768/1024/1440/1920 render checks (0px horizontal overflow) all pass.
- **2026-10-09** — Motion/scroll pass (owner review). **Problem:** the section content fades up on scroll via the shared `Reveal` primitive. **Industries:** removed the four industry pills above the headline, darkened the intro copy to `--mk-ink`, and made the hand-drawn `Encircled` marker scroll-linked (it draws itself from `stroke-dashoffset` as the word enters the viewport and retracts on scroll-up; fully drawn under reduced motion). **Features:** the static scan preview was replaced with `FeatureScanAnimation`, a looping four-phase sequence (camera drift over a coded Unga label, shutter close plus flash, "AI reading label" shimmer, confirmed AI result) using CSS keyframes only, falling back to the result frame under reduced motion. **How it works:** the desktop preview now appears only once the list is scrolled into view (and on interaction), the step swap cross-fades (`mk-step-swap`), the active orange banner uses `--mk-r-card` rounding, and the chips fade in. Typecheck, marketing lint, 92 tests and the production build pass.
- **2026-10-09** — Responsive + reveal pass. Added the shared `Reveal` fade-up to the rest of the content sections (How it works, Pricing, FAQ, Final CTA); every section except the footer now fades in on scroll, and the FAQ grid was nested under the `Reveal` so its 12-column layout is preserved. Introduced deliberate tablet layouts: the hero device cluster becomes phone-centred with the capability and AI cards side by side at `md` before the three-column desktop arrangement at `lg`; Industries puts the counter on its own full-width row and the feature and visual cards side by side at `md`; Features switches to its two-column media/text split at `md`. Audited 320/360/390/480/640/768/900/1024/1280/1440/1920 for horizontal overflow (0px at every width) and verified all seven sections reveal on scroll. Typecheck, marketing lint, 92 tests and the production build pass.
- **2026-10-09** — Mobile layout corrections (owner review). **Features (mobile only):** the copy now leads and the scan animation follows (`order-1`/`order-2`, restoring the media-left layout at `md`+), and the Voice input card stretches edge-to-edge on mobile (`-mx-6 w-[calc(100%+3rem)]`, back to 168px at `md`+). **How it works (mobile + tablet):** replaced the per-row inline accordion with a single widget below the list, and the active step is now scroll-driven (the orange banner and widget advance as each row crosses the 42% focus line and retract on scroll-up), removing the accordion feedback loop that caused flicker. **Pricing:** corrected the order to Solo, Team, Growth on every breakpoint (the previous mobile override put Team first). Typecheck, marketing lint, 92 tests, production build and 320-1920 render checks (0px horizontal overflow) pass.

**How to update:** same convention as other HisaFlow docs — `In progress` when work starts; `Done` when merged with PR link/date; Done only when the layer's criteria **and** `hisaflow-agent-build-briefs.md` §1.5 are met.

---

## 14. Decisions — defaulted (revisit with the owner)

1. **Brand accent colour:** default `#FF5A1F` (warm orange, as in two references); change in one token if the brand differs. *Owner to confirm.*
2. **Page canvas:** cool light tint `#ECEEF5`; light/dark card rhythm as in Section 5.
3. **Typeface:** single family, default Plus Jakarta Sans, self-hosted; verify licence/availability at build.
4. **Hero primary buttons ink; accent appears below the hero.**
5. **Inline-image headline signature:** max one per headline, max three per page.
6. **Photography:** optional; UI-first design that is complete without photos.
7. **Hero floating cards:** feature card (flag-gated) + founder note **only if supplied**; no stats, stars, or logos until real.
8. **Third-party logos (M-Pesa, Paystack, card networks):** text-only until brand-guideline permission is confirmed.
9. **No autoplay anywhere; CSS-first motion; no animation library by default.**
10. **Demo video and testimonials:** sections omitted until real content exists.
11. **Pricing card order on mobile:** Team, Solo, Growth.
12. **Sample-data caption** shown under the device mockup.

---

## 15. Final guidance to the agents

- Study the three reference images before writing code, and re-check them at the end of every layer. If your output could be mistaken for a generic template, it has failed the "engineered" bar in Section 2.
- Never copy reference text, brands, imagery, or invented trust signals. Never invent testimonials, ratings, user counts, or customer logos.
- Never hardcode prices or claims; read plans from the shared source and gate capabilities with claims flags.
- Never ship a placeholder, a fabricated screenshot, or numbers that don't reconcile.
- Stay inside the declared layer's scope; do not restyle or refactor the authenticated app.
- When something needed doesn't exist (screenshots, copy, photos, founder note, logo permissions), **stop and report it** instead of improvising.
- Verify third-party specifics (font licence, framework image/font APIs, auth middleware config, brand-guideline permissions) against current documentation at build time.
