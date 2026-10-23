# HisaFlow — Workspace Customisation: Agent Directive

**Status:** In progress — C-0 and C-1 complete; C-2–C-5 implemented with the 2026-10-19 production follow-up (see §12 and §12.1). Decisions defaulted to industry standard (Section 11).
**Supersedes:** the customisation parts of `hisaflow-ui-feel-and-workspace.md`. That file's sections on default Home content, table arrangement, KPI/Home redesign, and the full widget catalog are **out of scope and already handled — agents must not act on them.** Use this document only.

**Ground rules:** `hisaflow-agent-build-briefs.md` Part 1 and `hisaflow-quality-and-assistant-overhaul.md` Section 1 apply in full: every change passes lint, type-check, the existing test suite, and CI using the repo's own commands, with no suppressions, skipped tests, or loosened configs. "Green" is necessary, not sufficient — behaviour and feel must be verified.

---

## 0. Scope

### In scope (the only things to build)

1. **Switch layouts** — move between built-in layout templates and the user's own saved layouts.
2. **Add widgets** — from a widget gallery.
3. **Remove widgets.**
4. **Swap / replace a widget** with another in place.
5. **Move and resize widgets** (preset sizes).
6. **Return to default** — reset the layout, or reset everything.
7. **Change the wallpaper.**
8. **Customise widgets** — colour, surface style, size, title/icon, and widget-specific display options.
9. An **OS-grade feel**: calm, tactile, responsive, forgiving.

### Out of scope (do not touch)

Default Home content per vertical, the Home layout itself, table design/arrangement, KPI card redesign, the widget catalog's content and metrics, navigation/shell changes, and any change to the data a widget shows. The agent builds the **customisation layer on top of whatever Home and widgets already exist.**

### What was and wasn't verified

I have not read the current Home or widget code. Phase C-0 (Section 9) is mandatory and read-only: find out what already exists (a widget abstraction, a registry, a grid, any persisted preferences, theming, dark mode) and build on it rather than beside it. If widgets are currently hard-coded per vertical, the first job is the smallest safe registry that wraps them **without changing what they display.**

---

## 1. The experience: what "high-end OS" means here

The behaviour users expect from a polished phone or desktop OS, translated to a business app:

| Quality                         | What it means in practice                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discoverable, not mandatory** | Home works perfectly with zero customisation. A visible **Customise** entry (and long-press / right-click) reveals editing.                             |
| **Direct manipulation**         | Drag widgets, see where they will land, drop to snap. Context menus appear on the widget itself.                                                        |
| **Forgiving**                   | **Undo** after every destructive action; **Cancel** discards an edit session; **Reset** always available; nothing is lost permanently.                  |
| **Instant feedback**            | Pressed states within ~100ms; previews before committing (wallpaper, colour, size); changes appear live.                                                |
| **Smooth, purposeful motion**   | Springs for pick-up/drop, staggered crossfade when switching layouts, gentle wallpaper crossfade. Motion explains cause and effect; it never decorates. |
| **Stable and safe**             | No layout jumps; a bad saved layout can never produce a blank screen; readability is protected whatever the user picks.                                 |
| **Personal**                    | Wallpaper, accent colour, per-widget colour and style, named layouts.                                                                                   |

**Motion tokens** (reuse the app's existing tokens if present): fast 150ms, base 220ms, slow 400ms; easing `cubic-bezier(.2,.8,.2,1)` for entrances/settles; a short spring for pick-up/drop. Animate only `transform` and `opacity`. Honour `prefers-reduced-motion` (replace movement with fades). No autoplay or looping decoration. Haptic feedback via the Vibration API is a **progressive enhancement only** (limited browser support — verify, never rely on it).

---

## 2. Interactions

### 2.1 Entering and leaving edit mode

- **Customise** button on Home (always visible, quiet) → edit mode. Also: long-press a widget (touch) or right-click / press the widget's menu button (desktop).
- Edit mode shows: grid guides, a **top bar** with **Add widget**, **Layout** switcher, **Wallpaper**, **Undo/Redo**, **Reset**, **Done**, **Cancel**; each widget gets a drag handle and a **⋯** menu.
- **Done** saves; **Cancel** discards the session (confirm if there are changes). Unsaved edits are never persisted by accident, and a refresh mid-edit restores the last saved state.

### 2.2 Add a widget

- **Widget gallery** (side panel on desktop, bottom sheet on mobile): categories, search, and a **live preview at each supported size** using real or sample data.
- Choose a size, then **Add**: the widget appears in the first free position (or drag it from the gallery to a chosen spot on desktop), scrolls into view, and briefly highlights.
- Only widgets **available to this organisation** are listed (business type, role, tier, feature flag). Unavailable-but-upgradable widgets may show a lock with an explanation; unavailable-for-other-reasons widgets are hidden. New widgets carry a "New" badge and are **never auto-added** to existing layouts.
- A widget that is already present can be added again only if it supports multiple instances (declared in the registry; e.g. a trend widget with different periods).

### 2.3 Remove

- ⋯ menu → **Remove**, or drag to a "remove" target on touch. Shows an **Undo** toast (~6 seconds). Removing returns the widget to the gallery; nothing is deleted from the system.

### 2.4 Swap / replace

- ⋯ menu → **Replace…** opens the gallery filtered to widgets that fit the current slot; choosing one replaces it **in the same position and size**, preserving the slot even if the new widget supports fewer sizes (it picks the nearest supported size).

### 2.5 Move and resize

- **Drag** to move; the widget lifts (scale 1.02, stronger shadow), a **ghost placeholder** shows where it will land, and others shift with a short transition. Auto-scroll when dragging near viewport edges.
- **Collision rule:** dropping onto a widget of the same size swaps them; otherwise widgets below shift down. No overlaps, ever.
- **Resize** via ⋯ → **Size** (S / M / L / W / XL — only those the widget supports); the content _changes_ to the size-appropriate view (not a scaled copy). A size change animates in 180–220ms.
- **Keyboard alternative (required):** focus a widget → Enter/Space to pick up → arrow keys move one cell → Enter to drop, Esc to cancel; sizes via the menu; screen-reader announcements for every move ("Sales Trend moved to row 3, column 7").
- **Mobile:** single-column grid (small widgets two across). Editing uses a list-style reorder with handles, plus the size menu — no precision dragging on a grid.

### 2.6 Layout switcher

- A pill/menu at the top of Home (and in edit mode) shows the **active layout name**; tapping lists layouts. Switching crossfades with a short stagger (≤ 400ms total) and never flashes empty.
- **Built-in templates** (read-only, composed only of widgets this organisation can actually use; defined in config per vertical): e.g. **Default**, **Essentials** (fewer, larger widgets), **Operations** (tasks and attention first), **Numbers** (trends and totals first). Template names and contents are config, not code.
- **Personal layouts:** **Save as…** from the current arrangement; rename, duplicate, delete. Editing a template never changes the template — it creates a personal copy ("Default (edited)") on Done.
- The active layout is remembered per device class (desktop/tablet/mobile) _or_ globally — see Decision 5.

### 2.7 Reset

Two clearly different actions, each with confirmation and **Undo**:

- **Reset layout** — restores the vertical's default arrangement for the current layout/breakpoint; keeps wallpaper and widget styles.
- **Reset everything** — layout, widget styles, wallpaper, accent, and surface settings back to defaults. Personal saved layouts are **not** deleted unless the user also chooses "delete saved layouts".

### 2.8 Context menu on a widget (⋯, long-press, right-click)

Size ▸ · Colour & style… · Settings… (widget options) · Replace… · Duplicate (if multi-instance) · Lock position · Remove. Items appear only if applicable.

---

## 3. Wallpaper

### 3.1 Behaviour

- Wallpaper appears on **Home only**; every other screen keeps solid surfaces so dense data stays legible.
- **Wallpaper picker:** a preview of the actual Home with the chosen wallpaper applied **live**, a grid of curated options, and light/dark awareness. Choosing previews instantly; **Done** saves. Changing wallpaper crossfades (≈400ms).
- **Sources:**
  1. **Curated presets** (launch): solid tints, soft gradients, restrained abstract patterns, a few original Kenya-inspired designs (no busy stock-photo landscapes). Each has **light and dark variants** and ships as AVIF/WebP in three sizes.
  2. **User upload — phase-gated** (Phase C-6) until a storage decision is made (Section 11). Constraints when enabled: client-side downscale (long edge ≤ 2560px), re-encode, size cap (≤ ~1.5 MB after processing), strip EXIF/location metadata, accept common image types only, validate server-side, private to the user.
  3. **Optional adaptive accent (stretch):** sample the chosen wallpaper's dominant colours client-side to _suggest_ accent colours (never applied without passing the contrast guard).
- Original or properly licensed assets only. **Do not copy Apple, Microsoft, or any OS wallpaper or iconography.**

### 3.2 Legibility safeguards (non-negotiable)

- **Widgets never sit on raw wallpaper.** Each widget has a controlled surface: **Solid** (opaque) or **Glass** (translucent over blurred wallpaper) or **Tinted** (solid with a colour tint).
- **Glass is bounded:** minimum opacity and an automatic scrim keep text contrast ≥ **AA** (4.5:1 body, 3:1 large) against the _worst_ region behind the widget. Check presets at build time and uploads at upload time; if the check fails, raise surface opacity automatically — the user can't pick an unreadable combination.
- **Global controls:** Transparency slider (Solid ↔ Glass, clamped to the safe range), Blur on/off, Light / Dark / System. With reduced-transparency or when `backdrop-filter` is unsupported, force Solid. (Browser support for these preferences varies — also provide in-app toggles.)
- **Dense data never renders on glass** (tables, forms, charts' data labels sit on solid surface within the widget).

### 3.3 Performance

- Wallpaper loads **after** the first meaningful paint of widgets, with a tiny blurred/dominant-colour placeholder; it must never be in the LCP path.
- Served responsively; cached by the service worker within a size budget; offline falls back to the preset's colour fill. No video or animated wallpapers.

---

## 4. Widget customisation

### 4.1 What users can change per widget

| Option              | Details                                                                                                                                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Colour**          | Pick from a curated palette (≈12 swatches) plus **Auto** (follows the global accent). Each swatch is a pre-validated **background/foreground pair for light and dark** that meets AA. **No free-form colour entry** (or, if a custom picker is offered, it is auto-corrected to the nearest AA-compliant pair). |
| **Surface style**   | Solid · Glass · Tinted (uses the widget's colour). Subject to the Section 3.2 bounds.                                                                                                                                                                                                                           |
| **Size**            | Any size the widget supports.                                                                                                                                                                                                                                                                                   |
| **Title and icon**  | Show/hide the title; rename (plain text, length-limited, sanitised); choose an icon from the app's single icon set.                                                                                                                                                                                             |
| **Display options** | Only those the widget declares: e.g. period (7/30/90 days), compact vs detailed, show/hide sparkline or delta, number of list items. Declared via the widget's config schema, rendered in a generic settings panel.                                                                                             |
| **Lock position**   | Prevents accidental moves.                                                                                                                                                                                                                                                                                      |

### 4.2 What users cannot change (by design)

- **Status semantics:** success/warning/danger colours and iconography are fixed so meaning is never lost.
- **Data definitions and what a widget measures** — customisation changes presentation and chosen options, not metrics.
- **Contrast floor** — nothing the user picks may drop below AA.
- **Critical system notices** (payment overdue, sync failure, security prompts) are **banners outside the widget system** and cannot be removed or hidden by customisation.

### 4.3 Global theme settings

Accent colour (curated, AA-checked), Light/Dark/System, density (reuse the app's existing setting if present), Transparency, Blur. Per-widget colour overrides take precedence over the global accent.

### 4.4 Live preview

Every change (colour, style, size, wallpaper) previews on the actual widget immediately; **Cancel** reverts the session.

---

## 5. Widget contract (minimum the customisation layer needs)

Each widget exposes a registry entry (build the **smallest** registry that wraps existing widgets; do not rewrite them):

- `id`, `title`, `description`, `category`
- `supportedSizes` (from S/M/L/W/XL) and a renderer per size _(already existing renderers are reused)_
- `multiInstance` (boolean)
- `availability`: required permissions / tier / business types / feature flag
- `defaultSize`
- `configSchema` (optional): typed options for display settings
- `styleSupport`: which style options apply (colour, surface, title, icon)
- `previewData` for gallery previews (sample data; never real customer data in shared previews)

Rules: each widget is wrapped in an **error boundary** (one failing widget never breaks Home) and keeps its own loading/empty/error/stale states; skeletons match final size; widgets stay **code-split** so adding the gallery doesn't bloat first load.

---

## 6. Data model, API, persistence

Additive only; confirm against the actual schema and reuse any existing preference storage.

**Stored shape (conceptual):**

```
UserWorkspace {
  userId, organizationId, schemaVersion, updatedAt,
  activeLayoutId,
  layouts: [ { id, name, templateId?,
               breakpoints: { desktop, tablet, mobile }: [
                 { instanceId, widgetId, size, x, y, locked,
                   style: { colour, surface, showTitle, title?, icon? },
                   config: { ...widget options } } ] } ],
  theme: { accent, mode, transparency, blur },
  wallpaper: { type: "preset"|"upload", id|assetRef, modeVariants }
}
```

- **Layouts are stored per breakpoint** so a desktop arrangement never wrecks the phone view; a missing breakpoint is derived from the template/default for that breakpoint.
- **Endpoints (illustrative):** `GET /workspace`, `PUT /workspace`, `POST /workspace/reset` (scope: layout | all), plus layout CRUD (create/rename/duplicate/delete). All org- and user-scoped; a user can only read or write their own workspace.
- **Validation (client and server) against shared types:** unknown widget ids ignored (not fatal), bounds-checked coordinates and sizes, widget availability re-checked on every read, **payload size cap (e.g. 64 KB)**, strings sanitised and length-limited, no stored content ever interpreted as code or HTML. Treat stored layouts as untrusted input.
- **Versioning:** `schemaVersion` with migrations; when a widget is removed or renamed in a release, saved layouts degrade gracefully (the slot is dropped, with a quiet notice).
- **Sync:** server is the source of truth; a **local cache** gives instant paint and offline editing; reconcile on reconnect with last-write-wins by `updatedAt` (no merge UI in v1). Save on **Done** (not on every drag).
- **Recovery:** a layout that fails validation falls back to the default and shows a quiet notice — never a blank screen or crash.
- **Undo history** is in-memory for the edit session only.
- Shared types for workspace/layout/widget-instance live in the shared types package so frontend and backend validate identically.

---

## 7. Tiering (floor/depth rule from `hisaflow-paywall.md` §1A)

- **Floor — all tiers:** edit mode; add/remove/replace/move/resize; wallpaper presets; accent and per-widget colour/style; reset; built-in layout templates; **up to 3 personal saved layouts**.
- **Depth — Team:** unlimited saved layouts; **organisation default layouts and role-based layouts** (e.g. owner vs cashier); wallpaper upload and organisation branding on Home.
- Rationale: personal comfort isn't paywalled; features that only matter with several people are. (Defaulted — Section 11.)

---

## 8. Quality gates (in addition to lint, types, tests, CI)

- **Edit-mode tests:** add, remove, replace, move, resize, undo/redo, cancel, reset (layout and all), switching layouts, saving as a personal layout, persistence across reload, across devices (two-session test), and across breakpoints.
- **Robustness:** corrupted/oversized/malicious layout JSON is rejected or recovered safely; widgets that no longer exist or aren't permitted are dropped gracefully; a widget throwing doesn't break Home.
- **Security:** cross-user and cross-tenant tests for every workspace endpoint must fail to read or write others' data.
- **Contrast:** automated AA checks for every wallpaper × surface style × colour pair × light/dark combination; the auto-correction guard is itself tested.
- **Accessibility:** full keyboard path for every action (including drag alternatives); screen-reader announcements; focus management after add/remove/swap/drop; focus rings; 44px targets; reduced-motion and reduced-transparency honoured.
- **Layout quality:** the overhaul doc's geometry checks (equal heights in a row, no overflow, no layout shift) must still pass in every layout and size at all seven viewports (360–1920px) — customisation must not be able to produce a broken layout.
- **Performance:** edit mode and gallery are lazy-loaded; Home's LCP and interaction budgets are unchanged for users who never customise; wallpaper never in the LCP path; drag stays at smooth frame rates on a mid-range phone.
- **Offline:** Home renders from cache; editing works offline and syncs on reconnect.
- **Usability evidence:** short task tests with real users (add a widget; change its colour; switch layout; change wallpaper; reset) — results recorded.

---

## 9. Phases

Each phase's "Done when" requires Section 8's relevant gates plus the standard definition of done. Backend precedes frontend within a phase, but frontend prompts are issued as soon as the API contract is stable.

### Phase C-0 — Discovery (read-only)

Report on: how Home and widgets are built today (hard-coded vs registry), existing grid/drag-and-drop/chart/data-fetching libraries, existing user-preference storage and theming/dark-mode support, PWA/offline behaviour, shared types package, design tokens and surface styles, tier-check mechanism, and baseline lint/type/test/CI results. Recommend the smallest safe registry design. **Done when** the owner confirms the report. No code changes.

### Phase C-1 — Foundations

Shared types; widget registry wrapping existing widgets without changing their output; widget error boundaries; workspace schema and validation; workspace API (get/put/reset, layout CRUD) with tenant and ownership tests; local cache layer. **Done when:** a layout can be saved, loaded, validated, and reset via API; corrupt inputs handled; cross-tenant tests pass; Home renders identically to before for users with no saved workspace.

### Phase C-2 — Edit mode: add, remove, replace, move, resize, reset

Edit mode, widget gallery with previews, drag with ghost placeholder and snapping, collision rule, preset resizing, keyboard alternative with announcements, undo/redo, cancel, reset (layout/all), mobile list-style editing. Library choice evaluated and recorded (see 9.1). **Done when:** all Section 8 edit-mode and accessibility tests pass; feel review (Section 1) signed off by the owner on desktop and a real phone.

### Phase C-3 — Layout switching

Built-in templates (config), save-as/rename/duplicate/delete personal layouts, switcher with staggered crossfade, template-edit-creates-copy behaviour, per-breakpoint handling. **Done when:** switching never flashes empty or jumps; templates contain only available widgets; limits (3 personal for floor tier) enforced by existing tier checks.

### Phase C-4 — Widget customisation and theming

Per-widget colour/surface/title/icon/options; generic settings panel driven by `configSchema`; global accent/mode/transparency/blur; contrast guard with auto-correction; live preview and cancel. **Done when:** every colour × surface × mode combination passes the automated contrast gate; status colours remain fixed; customisation cannot produce an unreadable widget.

### Phase C-5 — Wallpaper

Curated presets with light/dark variants, live-preview picker, crossfade, placeholder loading, legibility safeguards, reduced-transparency/no-`backdrop-filter` fallbacks. **Done when:** every preset passes contrast checks under every surface style; wallpaper never delays LCP; offline fallback verified.

### Phase C-6 — Team depth and optional extras

Org default and role-based layouts, unlimited saved layouts, branding (tier-gated); **wallpaper upload** only if the storage decision is recorded; **stretch:** widget stacks (several widgets in one slot, swipe/step through), adaptive accent from wallpaper. **Done when:** an owner sets a cashier layout and a cashier sees it, can override it, and can reset to the org default; tier gating verified.

### Phase C-7 — Feel polish and hardening

Motion tuning on real devices, haptics (progressive enhancement), performance and accessibility passes, telemetry review (privacy-safe: which widgets are added/removed, which templates are used). **Done when:** all Section 8 gates pass with evidence in PRs.

### 9.1 Library guidance

Evaluate what the repo already has before adding anything. Candidates: `react-grid-layout` (responsive breakpoints, mature) or CSS Grid with `dnd-kit` (strong keyboard and accessibility support). Compare bundle size, Next.js App Router compatibility (client-only component, no SSR mismatch), keyboard/screen-reader and touch behaviour, maintenance status; **verify the installed version's current API** (APIs change between major versions); record the decision and reasons. Do not add a dependency if existing ones suffice.

---

## 10. Ready-to-issue agent prompts

Every prompt begins: _Read `hisaflow-workspace-customisation.md` in full, `hisaflow-quality-and-assistant-overhaul.md` Sections 1–2, and `hisaflow-agent-build-briefs.md` Part 1. Scope is customisation only — do not change Home content, tables, KPI cards, or what any widget displays. Every change must pass lint, type-check, the existing test suite, and CI using the repo's own commands, with no suppressions, skipped tests, or loosened configs. Confirm real paths, libraries, and APIs in the code and current documentation before using them. If something needed is missing, stop and report._

**P-C0 — Discovery.** _Perform Phase C-0 and deliver the report. No code changes._

**P-C1-B — Foundations (backend + shared types).** _Implement the workspace schema, shared types, validation, API (get/put/reset, layout CRUD), size caps, versioning, ownership and tenant checks. Corrupted/oversized/malicious input and cross-tenant tests are mandatory. Done per Phase C-1._

**P-C1-F — Registry and cache (frontend).** _Wrap existing widgets in the smallest safe registry with error boundaries and a local cache layer, without changing what any widget renders for users with no saved workspace. Done per Phase C-1._

**P-C2 — Edit mode (frontend).** _Implement edit mode, gallery with live previews, add/remove/replace/move/resize, ghost placeholder and snapping, collision rule, keyboard alternative with announcements, undo/redo, cancel, reset, and mobile list-style editing, following Section 2. Evaluate and record the library choice per 9.1. Done per Phase C-2, including a feel review on a real phone._

**P-C3 — Layout switching.** _Implement built-in templates (config), personal layouts (save-as, rename, duplicate, delete), the switcher with staggered crossfade, template-edit-creates-copy, and per-breakpoint behaviour. Enforce limits via existing tier checks. Done per Phase C-3._

**P-C4 — Widget customisation and theming.** _Implement per-widget colour/surface/title/icon/options via the generic settings panel and `configSchema`, the global theme controls, and the contrast guard with auto-correction and automated tests. Status colours stay fixed. Done per Phase C-4._

**P-C5 — Wallpaper.** _Implement presets, the live-preview picker, crossfade, placeholder loading, legibility safeguards, and fallbacks. No upload until the storage decision is recorded. Done per Phase C-5._

**P-C6 — Team depth and extras.** _Implement org/role default layouts, unlimited saved layouts, and branding, gated by existing tier checks; wallpaper upload only if the storage decision exists; stretch items only if agreed. Done per Phase C-6._

**P-C7 — Polish and hardening.** _Motion tuning, haptics as progressive enhancement, performance and accessibility passes, telemetry review. Done per Phase C-7._

---

## 11. Decisions — defaulted to industry standard (revisit with evidence)

1. **Wallpaper on Home only;** all other screens use solid surfaces.
2. **Preset widget sizes** (S/M/L/W/XL); no free-form resizing; layouts stored per breakpoint.
3. **Save on Done**, server-side per user with local cache; last-write-wins.
4. **Curated colour palettes only** (AA-checked pairs); no unrestricted colour entry; status colours fixed.
5. **Active layout:** remembered **per device class** (so a phone and a desktop can use different layouts); user can opt to sync one layout everywhere.
6. **Tiering:** floor = edit, templates, wallpaper presets, colours, up to 3 saved layouts; Team = unlimited layouts, org/role defaults, upload, branding.
7. **Wallpaper upload deferred** until a storage decision (location, caps, retention) is recorded.
8. **Critical system notices are banners outside the widget system** and can't be removed.
9. **Templates are config**, composed only of widgets available to the org.
10. **Library** chosen by the agent's documented evaluation, preferring what's already installed.
11. **Haptics, widget stacks, adaptive accent** are progressive/stretch, not required for sign-off.
12. **Maximum widgets per layout:** 24 (tunable), to protect performance.

**Owner inputs still needed:** confirm the three personal-layout limit for non-Team users; approve the built-in template names and intent; choose the wallpaper storage approach; supply or approve original wallpaper artwork.

---

## 12. Progress tracker

| Item                                                         | Backend       | Frontend             | Notes                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-0 Discovery report                                         | —             | ✅ Done (2026-10-17) | Read-only; `hisaflow-workspace-c0-discovery.md`                                                                                                                                                                                                                                                                     |
| C-1 Foundations (schema, types, API, registry, cache)        | ✅ Done       | ✅ Done              | `user_workspaces` + `/workspace` API + validation + `buildWidgetRegistry` + `useWorkspace` cache; Home unchanged for non-customisers                                                                                                                                                                                |
| C-2 Edit mode (add/remove/replace/move/resize/reset)         | —             | 🟡 In progress       | **Production slice complete (2026-10-19):** inline drag reorder with drop indicator, keyboard pick-up/move, long-press/right-click/⋯ menu, mobile reorder controls, undo/cancel/reset, and a gallery that shows every widget with Add / On Home. Ghost placeholder, free-form collision, Replace… and redo pending. |
| C-3 Layout switching + templates + saved layouts             | ✅ (limits)   | 🟡 In progress       | Templates + save-as/rename/duplicate/delete + switcher done and preview live; crossfade and per-breakpoint template editing pending                                                                                                                                                                                 |
| C-4 Widget customisation + theming + contrast guard          | —             | 🟡 In progress       | Colour/surface/size/accent/transparency/blur + AA palette guard + **live Home preview (2026-10-19)** done; named theme base layer added (2026-10-23); title/icon/configSchema still pending                                                                                                                         |
| C-5 Wallpaper presets + picker + safeguards                  | —             | 🟡 In progress       | CSS presets (light/dark), live picker, **Home-wide wallpaper and live preview (2026-10-19)**, bounded surfaces done; crossfade/fallback matrix/upload pending                                                                                                                                                       |
| C-6 Team depth (+ upload, stacks, adaptive accent if agreed) | ☐ Not started | ☐ Not started        | Tier-gated                                                                                                                                                                                                                                                                                                          |
| C-7 Feel polish, performance, accessibility                  | —             | ☐ Not started        |                                                                                                                                                                                                                                                                                                                     |

**How to update:** `In progress` when work starts; `Done` when merged with PR link/date; Done only when the phase criteria, the Section 8 gates, and the definition of done in the overhaul doc §1.1 are met (green lint, type-check, tests, and CI with no suppressions).

---

## 12.1 Implementation status (2026-10-17; updated 2026-10-19)

### C-0 — Discovery (Done, read-only)

Report: `hisaflow-workspace-c0-discovery.md`. Key findings: all eight vertical
dashboards already share `DashboardKpiRows` + `StatCardConfig[][]` (the natural
widget shape); no grid/drag dependency exists; theme is device-local; there is
no server-side preference table; `packages/types` is declaration-only; tiering
is centralised in `EntitlementsService`. Recommendation adopted: wrap the
existing KPI configs, add no dependency, and use ordered breakpoint lists with
preset sizes for v1.

### C-1 — Foundations (Done)

**Backend**

| File                                                                    | Purpose                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma` + `migrations/20261017000000_add_user_workspace` | Additive `UserWorkspace` (`user_id`, `organization_id`, `schema_version`, `data` JSONB) with a unique `(user, org)` key and cascade FKs.                                                                          |
| `modules/workspace/lib/workspace-validation.ts`                         | Untrusted-input validator: 64 KB cap, schema-version gate, 24-widget/breakpoint cap, curated accents/surfaces/sizes, string sanitising, dangerous-key stripping, unknown-widget dropping, active-layout fallback. |
| `modules/workspace/workspace.service.ts`                                | Get/put/reset + layout create/update/delete/duplicate, all scoped to `(userId, organizationId)`; floor (3) vs Team (20 hard cap) limits reuse `EntitlementsService`.                                              |
| `modules/workspace/workspace.controller.ts`                             | `GET/PUT /workspace`, `POST /workspace/reset`, layout CRUD; staff may customise their own Home.                                                                                                                   |
| `workspace.types.ts`                                                    | Backend mirror of the canonical `@hisaflow/types` contract (documented; ts-jest cannot compile a type-only import from outside `rootDir`).                                                                        |

Guards: `workspace-validation.spec.ts` (11), `workspace.service.spec.ts` (15),
`workspace.controller.spec.ts` (4) — including corrupt/oversized payloads,
unknown widgets, tier limits, and cross-tenant reads.

**Frontend**

| File                                           | Purpose                                                                                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/workspace.ts`                             | Pure contract + helpers: registry, default/template arrangements, breakpoint resolution, resolve/with-instances, immutable add/remove/move/resize/style, AA palette + contrast guard, cache parsing. |
| `services/workspace.service.ts`                | Typed API client for every workspace endpoint.                                                                                                                                                       |
| `hooks/useWorkspace.tsx`                       | `WorkspaceProvider`: SWR server read + localStorage cache for instant paint, save-on-Done, reset and layout actions. Wired into the dashboard layout.                                                |
| `components/workspace/WidgetErrorBoundary.tsx` | One failing widget can never take down Home.                                                                                                                                                         |
| `features/dashboard/DashboardKpiRows.tsx`      | Builds the registry from the vertical's existing config; renders the original markup when no workspace is saved, the customised ordered grid when one is.                                            |

Guards: `lib/workspace.spec.ts` (25) and `DashboardKpiRows.spec.tsx` (12,
including “no workspace → original arrangement”, empty-breakpoint fallback,
live-preview theme, long-press, drag and keyboard reorder).

### C-2–C-5 — Implemented slice (In progress)

`components/workspace/WorkspaceSheet.tsx` is the editor: widget list with
add/remove/move (up/down buttons, keyboard-operable) and S/M/L size; a gallery
listing every widget with Add / On Home; built-in templates; personal layouts
(save-as, rename, duplicate, delete, switch); accent palette;
transparency/blur; per-widget colour/surface; wallpaper presets; Undo, Cancel,
Reset layout/Reset all (with inline confirmation) and Done. Every change is
previewed live on Home (via the provider's `preview`) and persisted only on
Done. A quiet **Customise** entry sits above the KPI grid on every dashboard;
editing itself happens inline on the grid (long-press/right-click menu, drag,
buttons, keyboard), with the sheet used for deeper panels.

`components/workspace/WorkspaceBackdrop.tsx` applies the chosen wallpaper to the
Home content area and follows the live draft, while every other dashboard
screen keeps solid surfaces.

### Production follow-up (2026-10-19)

The owner checked the deployed Home and reported four blockers. Each is fixed
in the current working tree and has a regression guard:

| Report                                                             | Root cause                                                                                                                                                                                  | Fix                                                                                                                                                                                                                                                                                               | Regression guard                                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Changes in the Customise panel were not visible on Home.**    | The panel edited a local draft, and the Home edit surface read theme values from `workspace` (server state) rather than the live `preview`; wallpaper was applied only inside the KPI grid. | `WorkspaceSheet` and `DashboardKpiRows` now share the provider's `preview`. The Home grid reads `rendered.theme` (the preview while editing), and `WorkspaceBackdrop` applies wallpaper across the Home content area. The panel also states that closing it reveals the live preview.             | `DashboardKpiRows.spec.tsx` (“previews theme and colour changes on the live Home grid”), `WorkspaceBackdrop.spec.tsx` (“follows the live preview…”) |
| **B. Long-press on a widget did not offer customisation options.** | Only the ⋯ button opened the menu; there was no pointer long-press or context-menu/keyboard path, and the ⋯ affordance was hidden on touch devices.                                         | Long-press (550ms, cancelled by >10px movement/scroll), right-click, and `Shift+F10`/ContextMenu open the widget menu with Edit Home, Move, Resize, Style & colour, and Remove. The ⋯ button is visible on mobile, and menu focus/Escape are handled.                                             | `DashboardKpiRows.spec.tsx` (long press, scroll cancellation, right-click, ⋯ menu)                                                                  |
| **C. Widgets could not be moved or added at will.**                | No drag reorder; reorder was only available through controls, and the gallery only listed widgets that were not already on Home (so it appeared empty on the default layout).               | Edit mode now supports pointer drag with a drop indicator, a keyboard pick-up/arrow-move/Enter-drop alternative with live announcements, and the existing up/down/resize/remove controls on every device. The gallery lists **all** widgets, marking those on Home and offering Add for the rest. | `DashboardKpiRows.spec.tsx` (drag reorder, keyboard pick-up, controls), `reorderInstance` tests in `lib/workspace.spec.ts`                          |
| **D. Wallpaper could not be changed on the Home screen.**          | Wallpaper was limited to the KPI grid/local panel draft, so choosing a preset did not change the Home background and did not survive as a Home-wide surface.                                | New `WorkspaceBackdrop` wraps the Home content, follows `preview ?? workspace`, applies light/dark presets with a stable minimum height, and leaves every other dashboard screen solid. The picker previews the actual wallpaper variant.                                                         | `WorkspaceBackdrop.spec.tsx` (Home wallpaper, live preview, non-Home screens, default wallpaper)                                                    |

### Theme-system integration (2026-10-23)

- The named theme system (`docs/theme/`) is now the base layer under workspace
  customisation. Theme tokens supply colour/shape/depth/density/motion; the
  workspace continues to own layout, per-widget overrides, accent and wallpaper.
- Theme changes preserve layouts, saved layouts and widget overrides. Workspace
  reset preserves the selected theme (and vice versa).
- `WorkspaceBackdrop` now layers the generated `--hf-workspace-scrim` over the
  wallpaper so widget text keeps its contrast budget under every named theme.
- The per-widget contrast guard remains: curated accent/surface pairs and the
  `ensureReadable` check still apply on top of the theme tokens.

### Deliberate v1 constraints (recorded, not silent)

- **Ordered flow + preset sizes**, not free-form `x/y` drag. Pointer drag
  reorders the flow with a drop indicator and every move has a button and
  keyboard path; there is still no free-form collision engine or drag ghost.
  Free-form positioning remains a later C-2 increment (evaluate `dnd-kit`).
- **Replace… and redo** are not implemented yet (remove + add and Undo cover
  the recovery need).
- **Per-breakpoint editing** edits one device class at a time; templates apply
  to the current breakpoint. Other breakpoints keep their saved/default state.
- **Wallpaper** uses CSS gradient presets (no image assets, no upload). It is
  applied Home-wide and previews live, but crossfade and the full preset ×
  surface × mode contrast matrix are still pending.
- **Title/icon and configSchema display options** are in the data model but not
  surfaced in the editor yet. App light/dark stays under Settings.
- Backend types mirror `@hisaflow/types`; the frontend consumes the shared
  package type-only. Keep the two in sync when the contract changes.

### Gates (re-run 2026-10-19 after the production follow-up)

| Gate                      | Result                     |
| ------------------------- | -------------------------- |
| Backend `tsc --noEmit`    | Pass                       |
| Backend lint              | 0 errors (warnings only)   |
| Backend tests             | **110 suites / 878 tests** |
| Backend `nest build`      | Pass                       |
| Frontend `tsc --noEmit`   | Pass                       |
| Frontend lint (repo-wide) | 0 errors (warnings only)   |
| Frontend tests            | **41 files / 248 tests**   |
| Frontend `next build`     | Pass                       |
| Admin typecheck / tests   | Pass / 12 tests            |
| E2E typecheck             | Pass                       |

---

## 13. Final guidance to the agents

- Start with Phase C-0. Don't assume what exists; read the code.
- **Build on top, don't rebuild.** Wrap existing widgets; never alter what they display.
- **Users must never be able to break Home.** Validate everything, recover to the default, isolate widget failures, and make every customisation reversible.
- **Readability is a floor, not a preference.** Colour, glass, and wallpaper choices are clamped so text always passes AA.
- **Every drag has a non-drag path** (keyboard and touch), with announcements.
- **Feel is a requirement, not polish.** Test on a real mid-range phone; if drag, switch, or wallpaper change stutters, it isn't done.
- Keep the paywall boundary clean: tier gates use the existing checks; no custom gating logic.
- Verify library APIs and browser-support claims (`backdrop-filter`, reduced-transparency, vibration) against current documentation at build time.
- Stay in scope; when something needed is missing, stop and report instead of improvising.
