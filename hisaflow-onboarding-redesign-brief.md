# HisaFlow Onboarding Redesign — Agent Brief

## 1. Objective

The current Clerk-based sign-in/sign-up flow is functionally correct but visually generic — it doesn't read as HisaFlow, it reads as "default Clerk theme." This brief covers a **visual reskin only**. Auth logic, hooks, redirect URLs, and Clerk's underlying flows are untouched.

**Goal:** onboarding should feel like the front door of the same product as the rest of the app — not a bolted-on template — while feeling deliberate and premium, not AI-generated. This is a **visual-only** change: layout, color, motif, typography treatment, input/button styling. All copy stays exactly as it is today.

## 2. Non-goals (read this before touching anything)

- Do not modify Clerk auth logic, `useSignIn`/`useSignUp` hooks, session handling, or redirect/callback URLs.
- Do not fork away from Clerk's managed components unless `appearance` genuinely cannot achieve a specific visual (see §6).
- Do not introduce a new color palette disconnected from the app's existing design tokens. Pull real values from the existing CSS variables (`--color-primary` etc.) — do not invent new hex codes from scratch.

## 3. Design direction

**Layout pattern: full-bleed branded backdrop + rising sheet.**

Reasoning: HisaFlow already uses rounded, bottom-rising sheets everywhere in-app (`AddItemSheet`, `BarcodeScannerSheet`, `ReceiveStockSheet`, etc.). Onboarding should use the same silhouette — a branded color backdrop behind, with the auth form rising as a rounded-top sheet over it — so it feels continuous with the product instead of a separate template. This is directly inspired by the "Welcome Back" panel in the plant-app inspo and the foliage-backdrop inspo, adapted to HisaFlow's own visual language rather than copied.

**Rejected alternative:** split card-over-header layout (card overlapping a colored top header, both visible at once). Doesn't match the app's existing full-sheet interaction pattern as closely.

## 4. The "premium, not AI" rules

These are the two hard constraints from the client and they govern every visual decision below:

- **A. Deliberate, professional, premium** — nothing should feel like it's filling empty space. Every shape/color/copy choice should be explainable in one sentence.
- **B. No "AI feel"** — specifically avoid the recognizable tells of generated/templated design.

### Explicitly banned

- Gradient mesh blobs (soft, blurred, multi-color diagonal gradients)
- Glassmorphism / frosted-blur panels used as decoration
- Floating orbs, particle scatter, or dot fields behind text
- Centered abstract shape with a soft outer glow
- Any raster/AI-generated background image used as the primary motif
- More than 2–3 tones in the branded zone

### Required instead

- **Concept-first motif.** The backdrop motif must represent something specific in one sentence — e.g. "stock building/flowing through a business" (ties directly to "Hisa" = stock/share, "Flow" = movement). Do not start from "pick a nice abstract shape."
- **Flat color, crisp or deliberately-curved edges.** No blur. If any gradient is used, it must be a subtle two-stop tonal shift within the *same* hue (e.g. dark teal → slightly lighter teal), never a multi-hue gradient.
- **2–3 tones max**: base backdrop color, one lighter tint of the same hue for the motif, optionally one small accent color.
- **Anchored placement, not centered.** Pin the motif to a corner or edge, allow it to bleed off-canvas, keep it asymmetric — not floating in the middle of empty space.
- **Hand-built SVG, not a generated raster image.** Build the motif as an actual vector asset with deliberate paths (Figma export or hand-coded SVG). This is the single most important technical instruction — a generated background image is the most common source of the "off" AI look, and a hand-built SVG scales cleanly and can be restyled for dark mode later.
- **Typography carries weight too.** The headline should be confidently oversized and well-kerned (see inspo: "Create Account.", "Welcome Back!"), not left at Clerk's default header size. Good typography does as much "this was designed" work as the motif.

## 5. Visual spec

### Backdrop (branded zone)
- Base color: app's existing primary brand color (pull from design tokens, do not invent).
- Motif: one hand-built SVG shape/mark, anchored to a corner/edge, using the flow/growth concept above. Flat fills only, 2–3 tones max, no blur, no glow.
- No photography for v1 (flat color + motif was the agreed direction).

### Sheet (form container)
- Off-white/light background, rounded top corners, rises over the backdrop — same corner-radius and elevation conventions as the app's existing mobile sheets (`AddItemSheet` etc.) for visual continuity.
- Contains: custom headline + subhead (see §7), the Clerk-rendered form, footer link (switch sign-in/sign-up).

### Inputs
- **Pill-shaped, icon-prefixed.** Confirmed direction (rejected: bare underline inputs — reads more "fashion/social app" than "business tool you trust with your stock numbers").
- Icon sits inside the field, left-aligned, muted color until focused.
- Focus state: border/ring in brand primary, no glow/shadow bloom.

### Buttons
- Primary CTA: full-width pill, solid brand color, bold label.
- Social auth buttons: compact circular icon row, clearly secondary — not styled to compete with the primary CTA.

### Typography
- Headline: same existing copy (Clerk's current `headerTitle`/`headerSubtitle` text), restyled at an oversized, confident weight instead of Clerk's default header size. Visual treatment changes, wording does not.
- Subhead: existing copy, same treatment — restyled, not rewritten.
- Keep body/label typography inherited from the app's existing type scale — the headline is the one deliberate upsize, not a wholesale font change.

## 6. Clerk implementation approach

Do the reskin almost entirely through Clerk's `appearance` prop. Do not rebuild the form.

**`appearance.variables`** (global strokes):
- `colorPrimary` → brand primary
- `colorBackground` → transparent/matches sheet background
- `borderRadius` → pill-friendly radius
- `fontFamily` → inherit app's existing font stack

**`appearance.elements`** (targeted overrides):
- `card` → transparent, no shadow (it sits inside our own sheet, not Clerk's own card chrome)
- `headerTitle` / `headerSubtitle` → hidden; replaced by our own custom headline/subhead rendered in the shell component, above/around the mounted Clerk form
- `formFieldInput` → pill shape, padding for icon prefix
- `formFieldInputIcon` / icon slot → left-aligned prefix icon
- `formButtonPrimary` → full-width pill, brand color
- `socialButtonsBlockButton` → compact circular icon button
- `footerActionLink` → styled to match app link conventions
- `dividerRow` / `dividerText` → restyle "or continue with" divider to match, don't leave Clerk default styling

**Escalation path:** if a specific detail genuinely can't be achieved via `appearance` (e.g. exact icon inset positioning), use `@clerk/elements` for *that one field only* — not a full custom rebuild. Default to `appearance` theming for everything else.

**Shell component:** build one reusable "branded auth shell" (backdrop + rising sheet + headline/subhead slot) that wraps whichever Clerk component is currently active. Sign-in, sign-up, forgot-password, and OTP verification should all inherit the same shell automatically rather than four separate reskins.

## 7. Copy

**No copy changes in this pass.** All existing headline/subhead/button/microcopy text stays exactly as it is today. This is a visual-only reskin — do not rewrite, "warm up," or restyle any strings. If Clerk's default header text (`headerTitle`/`headerSubtitle`) is hidden per §6, replace it with the *existing* copy repositioned into the shell's headline/subhead slot, not new wording.

## 8. States to cover

All of the below must go through the same shell and pass the same visual bar:

- Sign in
- Sign up
- Forgot / reset password
- OTP verification
- Inline validation errors
- Loading / pending state
- Social auth row
- Sign-in ↔ sign-up switch link

## 9. Responsive behavior

Mobile-first (this is a PWA, primary usage is mobile). On wider viewports, the sheet should not simply center-and-abandon — constrain its width sensibly and let the backdrop presence still read as intentional, not just a big empty background.

## 10. Build sequence

1. Pull current Clerk implementation + existing design tokens (CSS variables, font stack, radius/shadow conventions already used elsewhere in the app) to inherit consistency.
2. Design and build the backdrop motif as a hand-built SVG per §4/§5.
3. Build the reusable branded auth shell component (backdrop + rising sheet + headline/subhead slot).
4. Apply `appearance` theming (variables + elements per §6) so the Clerk form sits correctly inside the shell.
5. Wire all states in §8 through the shell; verify each one individually, keeping existing copy intact.
6. Responsive pass per §9.
7. QA against the checklist below.

## 11. Acceptance checklist (QA before calling this done)

- [ ] No gradient blobs, glassmorphism, floating orbs, or centered-glow shapes anywhere
- [ ] Motif is a hand-built SVG, not a generated raster image
- [ ] Motif is anchored/asymmetric, not centered in empty space
- [ ] 2–3 tones max in the branded zone
- [ ] Headline typography is confidently sized, not left at Clerk defaults
- [ ] Inputs are pill-shaped with left-aligned icon prefixes
- [ ] Primary CTA is a full-width pill in brand color; social buttons are visually secondary
- [ ] Sheet corner radius/elevation matches existing in-app sheets (`AddItemSheet` etc.)
- [ ] All existing copy is unchanged — no rewritten strings anywhere
- [ ] All 8 states in §8 render correctly through the shared shell
- [ ] Text contrast passes on the branded backdrop (check against actual brand color, not assumed)
- [ ] No changes to Clerk auth logic, hooks, or redirect URLs

## 12. Decisions already locked in (don't re-litigate)

- Layout: full-bleed backdrop + rising sheet (not split card-over-header)
- Backdrop: flat color + abstract motif (not photography) for v1
- Input style: soft pill fields, icon-prefixed (not underline style)
- Copy: unchanged from current — visual-only pass, no rewrites

## 13. Open for the agent to propose

- Exact motif concept/shape (must satisfy §4 constraints — propose 2–3 options with one-sentence rationale each before building)
- Exact accent color if a third tone is used beyond primary + tint
