# HisaFlow — Landing Page: Blueprint & Implementation Guide

**Status:** Ready for review; decisions defaulted to industry standard (Section 8) so work can start
**Depends on:** Clerk auth + onboarding (existing), `hisaflow-paywall.md` (plans, trial, checkout), `hisaflow-tax-system.md` (for what may be claimed about tax)
**Purpose:** Define what the public landing page says, how it is structured, and exactly how it hands visitors into sign-up, onboarding, trial, and payment. Structure follows patterns consistently reported across current SaaS landing-page research, adapted for Kenyan SME buyers.

---

## 1. The funnel — and one correction to the assumed order

The working assumption was *landing → paywall → login*. For HisaFlow that order does not work, and the reason is structural, not stylistic:

- A `Subscription` belongs to an **Organization** (`hisaflow-paywall.md`, Section 4). An organization only exists after sign-up and onboarding. Paystack checkout also needs a customer identity (email/phone) that Clerk supplies at sign-up.
- The defaulted policy is a **14-day free trial with full Team access and no payment method upfront** (`hisaflow-paywall.md`, Section 7). Putting a payment wall *before* sign-up would contradict that policy and add the exact friction the trial exists to remove.

**Recommended funnel:**

```
Landing page (public)
   │  primary CTA: "Start free trial"
   ▼
Sign-up (Clerk)  ── plan intent carried as ?plan=solo|team
   ▼
Onboarding (existing page.tsx: business type, org creation)
   ▼
14-day trial in the app (full Team access)
   ▼
Paywall (authenticated) ── triggered at trial end, in-context feature locks, or billing settings
   ▼
Paystack checkout (M-Pesa primary, card secondary)
```

Two distinct pricing surfaces exist and must not be confused:

| Surface | Auth | Purpose | CTA behavior |
|---|---|---|---|
| **Pricing section on the landing page** | Public | Show tiers and prices to qualify visitors | CTAs go to **sign-up**, carrying plan intent — never straight to payment |
| **Paywall / checkout** (`hisaflow-paywall.md`) | Authenticated, org-scoped | Collect payment for an existing org | CTAs go to Paystack checkout |

Growth tier is "contact us": its CTA opens WhatsApp (pre-filled message), not sign-up.

**Returning users:** an authenticated visitor hitting `/` is redirected to the dashboard; the landing page is for logged-out visitors only.

---

## 2. What the research says (and how it is applied)

Findings consistent across the current sources reviewed:

- Converting SaaS pages follow a predictable order: **hero → social proof → problem/solution → features as benefits → how it works → pricing → FAQ → final CTA**. Typical pages use 5–8 sections.
- The hero states the **outcome**, not the feature, with one high-contrast primary CTA and real product UI rather than abstract illustration.
- Pricing works best late, after value is established, as 2–3 tiers with the recommended plan highlighted, followed by an FAQ that answers real objections. "No credit card required" is a standard objection-killer.
- Social proof is the strongest conversion lever; **specificity beats volume**.
- Speed matters: sources cite LCP ≤ 2.5s and roughly a 7% conversion effect per second saved. For Kenya specifically, sources recommend page weight ≤ ~1.5 MB, lean scripts, and click-to-WhatsApp as a primary action alongside forms. A commonly cited benchmark puts the median SaaS landing page at ~3.8% conversion — treat that as context, not a target for a brand-new product in this market.

**Where HisaFlow deliberately deviates from the generic playbook:**

1. **No fabricated or borrowed social proof.** HisaFlow is pre-launch. No invented testimonials, logo bars, user counts, or ratings — ever. Section 4 (Proof) lists honest substitutes.
2. **Monthly-only pricing display** (no annual toggle), per the earlier Kenyan-SME cash-flow decision in the monetization strategy.
3. **Claims are gated to shipped features.** Tax/eTIMS compliance is a headline differentiator, but it may only be stated as available once the tax system ships (Section 6).
4. **Multi-vertical product, single page first.** Research supports use-case-driven structures for multi-audience products; v1 uses one page with a vertical-selector section, vertical-specific pages come later (Phase L-F).

---

## 3. Page architecture (top to bottom)

Each section lists its job, content, and the objection it answers. Copy below is **draft direction, not final copy** — final wording needs a human pass.

### 3.1 Navigation (sticky)
Logo · 3–5 links (How it works, Industries, Pricing, FAQ) · **WhatsApp** icon-link · **Sign in** (text) · **Start free trial** (button). No other competing links.

### 3.2 Hero
- **Headline (outcome, one sentence):** direction — *"Run your shop, guest house or ISP from one app."*
- **Subheadline:** who it's for + how — *inventory, billing, and daily operations for Kenyan small businesses, built to work with M-Pesa.*
- **Primary CTA:** "Start 14-day free trial" → sign-up. **Secondary CTA:** "Chat on WhatsApp".
- **Microcopy under CTA:** "No card needed · Pay with M-Pesa or card after your trial."
- **Visual:** a real product screenshot (dashboard or a vertical view) — not stock imagery or illustration. Mobile phone frame first, since the audience is mobile-first.

### 3.3 Proof strip (honest version)
Replaces the usual logo bar. Use only what is true at launch: *"Built in Kenya,"* *"M-Pesa & card payments via Paystack,"* *"Works on your phone,"* and — **only if true at that moment** — pilot/early-customer counts. Add real testimonials and logos the moment they exist (Section 4 explains how).

### 3.4 Problem → solution
Name the pain in the visitor's own terms: stock in notebooks, M-Pesa messages matched by hand, bookings on WhatsApp, customers cut off manually. Then one line of resolution. Answers: *"Is this for someone like me?"*

### 3.5 Industries ("Built for how your business actually works")
Selector or card row — Shops/Duka, Guest houses, ISPs, Schools (and others as shipped). Each card: one pain, one outcome, one link ("See how it works for guest houses"). Only show verticals that are **live or clearly labeled "Coming soon"**. This is HisaFlow's real differentiator versus generic POS tools and must be visually prominent, not buried.

### 3.6 Features as benefits
Feature → benefit → proof pattern, grouped as outcomes, not module names:
- *Know what's in stock before you run out* (inventory & reorder alerts)
- *Every sale, receipted* (receipts)
- *See where your money is going* (finance tab)
- *Tax handled as you sell* (tax) — **gated, see Section 6**
- *Get paid by M-Pesa, automatically matched* (payments)
Bento-style cards are a current, scannable format; keep each card to one benefit and one screenshot crop.

### 3.7 How it works (3 steps)
Sign up in minutes → tell us your business type → start recording sales. Reduces the *"is this complicated?"* worry. Must match the real onboarding flow exactly.

### 3.8 Product demo
Short (≤ 60–90s) screen recording or an annotated screenshot walkthrough. Lazy-loaded and **never autoplaying with audio**; must not blow the page-weight budget (use a poster image + load on tap).

### 3.9 Pricing (public view)
- Three cards: **Solo**, **Team** (highlighted "Most popular"), **Growth** (*"Contact us"*).
- Prices come from the single plan source of truth (Section 5.3) — provisional defaults: Solo KES 2,500/mo, Team KES 5,500/mo.
- Each card leads with what differentiates it (1 user; staff seats + full vertical depth; multi-location), not an identical bullet list. Content follows the floor/depth split in `hisaflow-paywall.md` Section 1A.
- Under the cards: "14-day free trial · No credit card required · Cancel anytime."
- M-Pesa and card shown as accepted methods. Be honest that M-Pesa renewals need an approval on the customer's phone each cycle (state this in the FAQ, not hidden).

### 3.10 FAQ (objection handling)
Eight questions, written from real objections (final answers must match shipped reality):
1. Do I need a card to start? *(No — 14-day trial, no card.)*
2. How do I pay? How does M-Pesa renewal work? *(M-Pesa prompt each billing cycle; card renews automatically.)*
3. What happens when my trial ends? *(Choose a plan; grace period applies to missed renewals — no instant lockout.)*
4. Does it work offline / on poor internet? *(Answer only per what is actually shipped — see Section 6.)*
5. Is my data safe, and who can see it? *(Security and access-control statement; link to Privacy Policy.)*
6. Can I add staff? *(Team tier.)*
7. Does it handle KRA tax invoicing (eTIMS)? *(Gated — Section 6.)*
8. Can I switch plans or cancel? *(Yes; upgrades immediate, downgrades at next renewal.)*

### 3.11 Final CTA
Repeat the primary CTA with outcome-specific copy plus the WhatsApp alternative. Echo the trust line from the proof strip.

### 3.12 Footer
Product links, Contact (WhatsApp, email), **Privacy Policy, Terms of Service** (Kenya Data Protection Act–aware), company details, social links.

---

## 4. Social proof plan (honest, staged)

| Stage | What may appear | Rule |
|---|---|---|
| Pre-launch | Verifiable facts only (built in Kenya, payment partners, supported verticals); optionally a short **founder note** explaining why HisaFlow exists | Nothing invented, nothing implied |
| Pilot | Named pilot customers **with written permission**: name, business, location, one specific outcome | Specific beats general; no quote without consent |
| Live | Real logos, quantified results, review-site badges once genuine | Cap at what can be verified |

If a section's proof doesn't exist yet, the section shrinks or is omitted — it is never filled with placeholders that could ship by accident. Placeholder content must be impossible to deploy (see Phase L-B done criteria).

---

## 5. Technical architecture

### 5.1 Routing & auth
- Landing lives at `/` for logged-out visitors; authenticated users are redirected to the dashboard.
- Public routes (`/`, `/pricing` if separate, `/legal/*`, vertical pages later) must be explicitly allowed in the Clerk middleware/route-protection config. **Verify the current Clerk middleware API in the installed version before editing** — do not assume the config shape.
- Confirm what `/` currently does in the existing build (redirect to sign-in? dashboard?) before changing it; the change must not alter behavior for authenticated users.

### 5.2 Plan-intent handoff
- Pricing CTAs link to sign-up with `?plan=solo|team`. The intent is preserved through Clerk's sign-up redirect into onboarding and stored on the new organization as a *preference*, not a purchase (the trial grants Team access regardless). At trial end, the paywall pre-selects the stored tier.
- Intent is advisory only: invalid or missing values fall back to no preselection. No pricing logic is computed from a query string.

### 5.3 Single source of truth for pricing
- Prices, tier names, and feature bullets are read from the same plan definition the paywall uses (shared type in `packages/types`, served by the backend or generated at build time) — **never hardcoded separately in the landing page**. Price drift between landing and checkout is a trust and legal problem, not a cosmetic one.

### 5.4 Performance & quality budget (hard gates)
- LCP ≤ 2.5s on throttled 4G mobile; total initial page weight ≈ ≤ 1.5 MB; no layout shift from late-loading images; images modern-format, sized, lazy-loaded below the fold; minimal client JS (prefer server-rendered/static output).
- Accessibility: semantic headings, color contrast, keyboard navigation, alt text.
- SEO: unique title/meta, Open Graph tags, structured data (Organization, FAQ), `sitemap.xml`, `robots.txt`, `.co.ke`/`.com` canonical decision.

### 5.5 Analytics & funnel measurement
Instrument the funnel so decisions can be data-led: landing view → CTA click (by position) → sign-up started → sign-up completed → onboarding completed → trial active → paywall viewed → checkout started → payment succeeded. Capture UTM/referrer on first touch. Choose a privacy-respecting analytics tool and honor consent requirements under the Kenya Data Protection Act before any tracking ships.

### 5.6 Lead capture & WhatsApp
- WhatsApp CTA uses a click-to-chat link with a **pre-filled message** (distinct per entry point: general, Growth/contact-us, vertical page) so the team knows the context. The number lives in config, not scattered through components.
- Optional light "Request a call/demo" form for visitors who won't sign up: minimal fields, validated server-side, stored with consent timestamp, rate-limited, spam-protected. Only if the team will actually respond — an unanswered form harms trust.

---

## 6. Claims policy — what the page may say, and when

The landing page is a public promise. Rule: **a claim ships only when the capability is live in production.**

| Claim | May be stated when | Until then |
|---|---|---|
| KRA eTIMS-compliant invoicing | Tax system Phase C (VSCU signing) is live and verified | Say "Tax compliance — coming soon" or omit |
| Works offline | Offline operation is actually shipped and tested | Omit from copy; FAQ answers honestly |
| ISP / guest-house modules | Those modules are live | Label "Coming soon" |
| M-Pesa payments | Paystack integration is live | Omit |
| Specific user counts, ratings, results | They are real and verifiable | Omit |

Implement as content flags (a config object per claim) so copy can be turned on without a redeploy of logic — and so a forgotten "coming soon" cannot masquerade as a live feature.

---

## 7. Execution phases

Follows the repo's standard: backend-light/frontend-heavy here, each phase with explicit "Done when." Ground rules, non-regression, lint/CI, and tooling in `hisaflow-agent-build-briefs.md` Part 1 apply in full.

### Phase L-A — Foundations
**Scope:** route structure, Clerk public-route configuration, authenticated-redirect from `/`, layout shell, design tokens, SEO scaffolding, legal pages (Privacy, Terms) stubs reviewed by a human, analytics scaffold (consent-aware).
**Done when:** logged-out `/` renders the shell; authenticated `/` redirects to the dashboard; sign-in/sign-up/onboarding behave exactly as before (regression-tested); legal pages exist and are linked; lint, type-check, existing tests, and CI are green.

### Phase L-B — Core sections
**Scope:** Sections 3.1–3.8 and 3.11–3.12, mobile-first, with real screenshots and the honest proof strip (Section 4), and the claims-flag mechanism (Section 6).
**Done when:** every section renders correctly from 360px upward; no placeholder or lorem text can ship (a build-time check fails the build if any placeholder token remains); gated claims render only when their flag is on; Lighthouse mobile performance/accessibility/SEO meet the budget in 5.4.

### Phase L-C — Pricing section & single source of truth
**Scope:** public pricing section (3.9) reading from the shared plan definition; Growth card → WhatsApp; trial microcopy; no hardcoded prices anywhere on the page.
**Done when:** changing a price in the plan source updates the landing page and the paywall identically, proven by a test; Growth CTA opens WhatsApp with the correct pre-filled message; copy matches `hisaflow-paywall.md` defaults.

### Phase L-D — Funnel wiring
**Scope:** CTAs → sign-up with `?plan=`; intent preserved through Clerk redirect into onboarding and stored on the organization as a preference; paywall pre-selects stored tier at trial end.
**Done when:** a visitor clicking "Team" on pricing signs up, completes onboarding, and later sees Team pre-selected at the paywall; missing/invalid intent degrades gracefully; existing direct sign-up (no intent) is unchanged.

### Phase L-E — Trust, FAQ, demo, analytics
**Scope:** FAQ (3.10, answers verified against shipped reality), demo module (3.8) within the page-weight budget, WhatsApp pre-filled variants, optional lead form (5.6), full funnel analytics events (5.5).
**Done when:** every FAQ answer is verified true against production behavior; funnel events fire in order in a test run and respect consent; demo lazy-loads and the page stays within the performance budget.

### Phase L-F — Vertical pages *(stretch, after launch data)*
**Scope:** dedicated pages for live verticals (guest houses, ISPs, shops, schools) following the same skeleton with vertical-specific hero, pains, and screenshots; internal links from the industries section.
**Done when:** each page ships only for a live vertical, passes the same budget, and has unique SEO metadata.

---

## 8. Decisions — defaulted to industry standard (revisit with data)

1. **Funnel:** landing → sign-up → onboarding → trial → paywall (Section 1). Payment is never requested before an organization exists.
2. **Primary CTA:** "Start free trial"; secondary: WhatsApp.
3. **One page first;** vertical pages deferred to L-F.
4. **Monthly pricing display only;** no annual toggle.
5. **No social proof until real;** staged plan in Section 4.
6. **Analytics:** privacy-respecting tool, consent-aware; specific vendor chosen at implementation, subject to Kenya DPA requirements.
7. **Domain / canonical (.co.ke vs .com):** not decided here — choose before SEO work in L-A and record it.
8. **Copywriting:** drafted directionally here; final copy gets a human edit before launch (English first; Swahili variant is a later option, not v1).

---

## 9. Progress tracker

| Phase | Layer | Status | Notes |
|---|---|---|---|
| L-A. Foundations | Frontend (+ config) | ✅ Done (2026-10-06) | Route group + `(marketing)/layout.tsx`; Clerk public routes `/`, `/legal`, `/gallery`; authenticated `/` redirects to `/dashboard` and the dashboard home tab is repointed; design tokens added; legal pages (Privacy, Terms) shipped and linked; `sitemap.xml`, `robots.txt`, Organization/FAQ JSON-LD, canonical metadata; consent-gated analytics scaffold (`lib/analytics.ts`, no vendor, no-op by default). Domain defaulted to `hisaflow.co.ke` via `NEXT_PUBLIC_SITE_URL` (Section 8.7 still owner-confirmable). |
| L-B. Core sections | Frontend | 🟡 In progress | All sections 3.1–3.8 and 3.11–3.12 render 360px+; honest proof strip; claims flags gate eTIMS/offline. Placeholder-ban test added (`lib/placeholder-ban.spec.ts`, runs in CI). Remaining: run Lighthouse mobile against the Section 5.4 budget and record evidence in the PR; replace the coded hero dashboard with a real seeded screenshot before launch (see V-2 note). Every content section except the footer now fades in on scroll via `Reveal`, and the hero, Industries and Features have deliberate `md` tablet layouts. |
| L-C. Pricing & single source of truth | Frontend + shared types | ✅ Done (2026-10-06) | `lib/plans.ts` is the single frontend source for tier names, prices, differentiators and bullets; both the landing `PricingCard` and the paywall `TierCard` read it. Tests prove the provisional defaults (Solo 2,500 / Team 5,500 / Growth quote) and Growth → WhatsApp. Prices are not hardcoded in any marketing component. Note: the backend seed still duplicates the numbers; generating from one shared module is future work. |
| L-D. Funnel wiring | Frontend + backend (org preference) | ✅ Done (2026-10-06) | Pricing CTAs carry `?plan=solo|team`; sign-up forwards it to onboarding via Clerk `forceRedirectUrl`; onboarding validates and stores `preferredPlan` on the organization (new nullable column + migration `20261006000000_add_preferred_plan`); the paywall pre-selects the stored tier. Invalid/missing intent degrades to the default. Backend + frontend unit tests cover the storage and normalisation. |
| L-E. Trust, FAQ, demo, analytics | Frontend | 🟡 In progress | FAQ answers written to shipped reality; demo section omitted (no recording); WhatsApp pre-filled variants in config; analytics scaffold emits `landing_view` only with consent + a configured sink. Remaining: choose the analytics vendor and wire the remaining funnel events, and decide whether to add the optional lead form. |
| L-F. Vertical pages | Frontend | ☐ Not started | Stretch; post-launch. |

### Action log

- **2026-10-06** — Audited the previous agent's work: found the marketing page, sections, primitives, config and plan source present, but frontend `tsc` failing (2 files) and the trackers un-updated.
- **2026-10-06** — Fixed `PricingCard` relative imports and the `FAQ` config/component name clash; frontend typecheck, lint, tests and build now green.
- **2026-10-06** — Added legal pages, `sitemap.ts`, `robots.ts`, structured data, canonical metadata, the internal gallery route, the placeholder-ban test, keyboard/ARIA component tests, claims/plan tests and the analytics scaffold.
- **2026-10-06** — Wired plan intent end to end (L-D) with a Prisma migration and tests; repointed authenticated Home nav to `/dashboard`.
- **2026-10-06** — Added the spec's warm accent as a tertiary status token ("Coming soon"), kept core green as the single brand accent, and raised muted text to AA contrast.
- **2026-10-07** — Ran the built landing page locally. Found `/robots.txt` and `/sitemap.xml` returning 404 because Clerk middleware also matches `.txt`/`.xml`; added both to the public routes. Verified `/`, `/legal/*`, `/sitemap.xml`, `/robots.txt` all 200 and `/gallery` 404 in production.
- **2026-10-07** — Hero revision per owner review: full-bleed mesh (dropped the inset hero card), device angled on a 3D perspective with the supplied app capture filling the bezel, interactive interlaced capability rail (M-Pesa / KRA / Card) with auto-advance and a matched content card, a right-hand AI card, and the real logo mark in the nav.
- **2026-10-07** — Removed all em dashes from landing copy and metadata, reworded the affected sentences, and added an em-dash ban to the placeholder test. Frontend typecheck, lint, tests (122) and the full CI build are green.
- **2026-10-07** — Hero second pass: device set straight-on with a thick black body, inner metallic/grey bezel stroke, soft diffuse shadow, 38px-clipped screen, pill dynamic island and a 60%→100% bottom mask fade; the capability card now contains the interlaced avatar-stack circles (2px white borders, -12px overlaps, accent ring on the active circle). Typecheck, lint, tests (122) and build re-run green.
- **2026-10-07** — Hero third pass: device turned slightly right with a shiny metal left rail, a status bar added so the pill no longer disrupts the app content (image starts below it), and the interlaced circles given palette colours (M-Pesa green, KRA blue, Card warm) with solid fills on the active circle. Typecheck, lint, tests (122) and build re-run green.
- **2026-10-07** — Problem section rebuilt from `section-1.jpg`: full-bleed dark band with a floating white card, 2-column layout and a 2×2 bento of problem→solution tiles (stock, payments, tax, bookings) with mixed tones and coded UI crops; hero and problem now meet edge-to-edge. Typecheck, lint, tests (122) and build re-run green.
- **2026-10-07** — Problem follow-up: container changed to the hero's `--mesh-b` light blue spanning end-to-end (white card removed), the four bento tiles each given a distinct colour (white / green / accent-blue / ink), and the eyebrow dot replaced with two hand-drawn pen strokes under its last word. Typecheck, lint, tests (122) and build re-run green.
- **2026-10-07** — Problem follow-up 2: rounded the blue container corners (32px, inset 8/16px) and made the two imagery tiles full-bleed with the copy on a frosted `mk-glass-panel` overlay. Typecheck, lint, tests (122) and build re-run green.
- **2026-10-07** — Problem follow-up 3: imagery tiles made taller (`min-h-[340px]`) with richer coded UI backgrounds and a compact glass caption; the bento split into two balanced flex columns so the solid green/blue tiles keep their own size. Typecheck, lint, tests (122) and build re-run green.
- **2026-10-07** — Section-2 correction (Industries, Features, How it works): rebuilt the three sections under Problem to `section-2.jpg`. Industries is now a carousel (counter `01 /4`, prev/next, ink feature card, coded visual card with glass chips); Features is the activity block (centred floating analytics card over a coded dashboard, inline-chip headline, icon pills, accent CTA, coming-soon preview, three outcome tiles); How it works now overlaps a rotated white step card over the list. Brand accent stays core green; reference orange is mapped to the accent/tertiary tokens. Photo slots degrade to coded UI crops. Typecheck, lint, tests (122) and build re-run green. Full-viewport scroll snap intentionally omitted (Section 6 forbids scroll-jacking; sections are variable-height; no GSAP added).
- **2026-10-08** — Section-2 correction, colour/detail pass: added `--mk-ref-accent` (`#FF4500`) scoped to Industries/Features/How it works with `.mk-ref`, so those three sections now use the reference image's bright orange while the rest of the page keeps the core accent; added `.mk-float-panel` (soft shadow + hairline) for the floating cards. Refined the Industries grid (`1fr 1.5fr 1.5fr`), header pills and two floating metric tags; reordered the Features column (pills before sub-text); moved the How-it-works step card inboard so the row arrow stays visible on the orange active banner. Professional lucide icons replace the reference's inline emoji/3D art. Added a desktop-only `scroll-snap-type: y proximity` on the inset card stack (non-hijacking, reduced-motion aware). Typecheck, lint, 92 tests, build and 1440/768/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Section-2 owner review pass 2. **Industries:** full-bleed card background that keeps its rounded corners, counter caption now "Vertical specific" with the word hand-encircled, dotless eyebrow, "actually" encircled in the headline, the inline store icon replaced with a coloured dimensional green badge, and the CTA plus next arrow restored to the core brand green (`.mk-core-accent`). **Features:** all copy replaced with the shipped AI and scanning story (barcode lookup, label OCR, receipt capture, plain-language AI ingestion, voice as an honest coming-soon), a coded camera-viewfinder media panel, new barcode/label/receipt tile crops, and a full-bleed square-edged section with a quiet palette mesh (`.mk-mesh-features`). `Section` gained `contentClassName` so a full-bleed background can hold a centred content column. Typecheck, lint, 92 tests, build and 1440/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Section-2 owner review pass 3. Moved the "Vertical specific" label to the Industries eyebrow (the word "specific" is marker-encircled) and removed the caption under the counter entirely. Rebuilt the hand-drawn accent as a deliberate marker loop (tighter box, 2.8px headline / 2px eyebrow strokes, a visible start/end overshoot) that clears the letters and no longer bleeds into neighbouring words. Features eyebrow is now "Hustle free"; the CTA reads "Streamline your process" and is back on the core green; the inline AI chip is a roomier bubble with more padding. Typecheck, lint, 92 tests, build and 1440/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Section-2 owner review pass 4. The marker accent now sits behind the text (`isolate` plus a negative z-index) and carries more padding on both "specific" (eyebrow) and "actually" (headline), so the letters stay crisp. Removed the dot from the "Hustle free" eyebrow. Added a subtle `--mk-e1` lift to the Industries section card and a subtle warm `--mk-e-accent` shadow to the three AI/scanning feature tiles. Typecheck, lint, 92 tests, build and 1440/390 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Hero-to-Problem transition pass. The Problem section is now a full-bleed band (rounded corners and side margins removed) opened by a top fade: the hero's white base blends down into `--mk-mesh-b`, with a soft green radial continuing the hero's bottom glow, so the two sections meet seamlessly. The Features (`Hustle free`) section gained a matching soft top fade and smokey white glow over its pastel mesh. The eyebrow encircling for "specific" got extra padding through a `sizeClassName` hook on `Encircled`. Typecheck, lint, 92 tests, build and 1440 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Layout pass 6. Removed every section eyebrow across the page (Problem "The problem", Industries "Vertical specific", Features "Hustle free", How it works, Pricing, FAQ); the `Eyebrow` primitive now survives only in the internal gallery and its final review state is no longer rendered on the landing page. Made How it works full-bleed while keeping its rounded corners, Pricing full-bleed with square corners, FAQ full-bleed with rounded corners, and the Footer full-bleed square with a new darker `--mk-mesh-ink-*` mesh gradient. Typecheck, lint, 92 tests, build and 1440 render checks (0px horizontal overflow) all pass.
- **2026-10-08** — Hero pass 7. Removed the protruding metallic side rail on the device (it read as the back of the phone and reversed its orientation) and replaced it with a flush metal glint, so the phone clearly faces right. The hero background now fades softly into the canvas at the bottom, the Problem band's top fade starts from that same canvas colour, and the hero/problem vertical padding was tightened, so the two sections bridge through the fade with no hard white gap. Added a restrained scroll parallax to the phone (`Parallax.tsx`: rAF, transform-only, capped at 48px, disabled under reduced motion) and widened the gap above the built-for row so the lag never collides with it. Typecheck, lint, 92 tests, build and render checks (0px horizontal overflow) all pass.
- **2026-10-09** — Hero/problem correction pass (owner review). Removed the `Built in` eyebrow from the capability card and the `HisaFlow AI` eyebrow from the AI card (the `HERO_AI.eyebrow` config field is gone). Rebuilt the three interlaced capability circles as dimensional buttons: per-capability top-light/bottom-dark gradients, a specular highlight, inset bevel highlights and a drop shadow, with saturated active fills and soft idle tints. Increased the `AnnouncementBadge` padding (`h-10`, roomier chip). Darkened the `Built for Kenyan businesses of every size` caption and its vertical icons to `--mk-ink-2`. Removed the device's heavy drop shadow so no grey halo shows behind the phone. Added a bottom fade to the Problem band so its lower edge dissolves into the canvas. Typecheck, lint, 92 tests, production build and 360/390/768/1024/1440/1920 render checks (0px horizontal overflow) all pass.
- **2026-10-09** — Motion/scroll pass (owner review). **Problem:** the section content fades up on scroll via the shared `Reveal` primitive. **Industries:** removed the four industry pills above the headline, darkened the intro copy to `--mk-ink`, and made the hand-drawn `Encircled` marker scroll-linked (it draws itself from `stroke-dashoffset` as the word enters the viewport and retracts on scroll-up; fully drawn under reduced motion). **Features:** the static scan preview was replaced with `FeatureScanAnimation`, a looping four-phase sequence (camera drift over a coded Unga label, shutter close plus flash, "AI reading label" shimmer, confirmed AI result) using CSS keyframes only, falling back to the result frame under reduced motion. **How it works:** the desktop preview now appears only once the list is scrolled into view (and on interaction), the step swap cross-fades (`mk-step-swap`), the active orange banner uses `--mk-r-card` rounding, and the chips fade in. Typecheck, marketing lint, 92 tests and the production build pass.
- **2026-10-09** — Responsive + reveal pass. Added the shared `Reveal` fade-up to the rest of the content sections (How it works, Pricing, FAQ, Final CTA); every section except the footer now fades in on scroll, and the FAQ grid was nested under the `Reveal` so its 12-column layout is preserved. Introduced deliberate tablet layouts: the hero device cluster becomes phone-centred with the capability and AI cards side by side at `md` before the three-column desktop arrangement at `lg`; Industries puts the counter on its own full-width row and the feature and visual cards side by side at `md`; Features switches to its two-column media/text split at `md`. Audited 320/360/390/480/640/768/900/1024/1280/1440/1920 for horizontal overflow (0px at every width) and verified all seven sections reveal on scroll. Typecheck, marketing lint, 92 tests and the production build pass.
- **2026-10-09** — Mobile layout corrections (owner review). **Features (mobile only):** the copy now leads and the scan animation follows (`order-1`/`order-2`, restoring the media-left layout at `md`+), and the Voice input card stretches edge-to-edge on mobile (`-mx-6 w-[calc(100%+3rem)]`, back to 168px at `md`+). **How it works (mobile + tablet):** replaced the per-row inline accordion with a single widget below the list, and the active step is now scroll-driven (the orange banner and widget advance as each row crosses the 42% focus line and retract on scroll-up), removing the accordion feedback loop that caused flicker. **Pricing:** corrected the order to Solo, Team, Growth on every breakpoint (the previous mobile override put Team first). Typecheck, marketing lint, 92 tests, production build and 320-1920 render checks (0px horizontal overflow) pass.
- **2026-10-09** — Deployment prep. Added `NEXT_PUBLIC_APP_URL` plus `isSplitDeployment`/`appHref`/`signInHref` to the site config, host-aware routing in `middleware.ts` (www -> apex, app root -> dashboard, legal on the apex, app `robots.txt` disallowed, app paths on the apex redirected to the subdomain, `/api/*` exempt), an `apps/frontend/.env.example`, and `hisaflow-deployment.md` (domains, DNS, env, release checklist). Host routing is inert unless `NEXT_PUBLIC_APP_URL` is set, so local dev and preview builds are unchanged. Added split-origin tests (94 total) and stopped tracking `*.tsbuildinfo` and the built `public/sw.js`. Pushed `main` and created/pushed the `prod` branch.

**How to update:** same convention as every other HisaFlow doc — `In progress` when work starts, `Done` once merged with PR link/date. A phase is Done only when its criteria *and* the Section 1.5 Definition of Done in `hisaflow-agent-build-briefs.md` are met.

---

## 10. Guidance for the agent picking this up

- Read this doc in full, plus `hisaflow-paywall.md` (Sections 1A, 2, 7) and `hisaflow-agent-build-briefs.md` Part 1, before writing code. Confirm actual file locations in the repo rather than assuming them.
- This work must not change behavior for existing authenticated users or the existing sign-up/onboarding flow. Regression-test those paths explicitly.
- Never hardcode prices, tier names, or plan features on the page — read them from the shared plan source.
- Never ship placeholder copy, invented testimonials, fake logos, or unverified numbers. The build must fail rather than allow it.
- Never state a capability the product doesn't have in production yet — use the claims flags (Section 6).
- Treat the performance and accessibility budget in 5.4 as a hard gate, not a nice-to-have; Kenyan mobile networks are the baseline test environment, not the exception.
- Verify third-party specifics (Clerk middleware/route config, Paystack checkout parameters, analytics consent requirements) against current documentation at build time; this doc was written at a point in time.
