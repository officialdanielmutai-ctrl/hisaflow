# Theme decisions (ADR log)

## ADR-001 — Theme definitions live in `@hisaflow/theme`; CSS is generated

**Decision:** `packages/theme/src/themes.ts` is the single source of truth.
`packages/theme/src/generate.ts` emits `apps/frontend/app/theme-tokens.generated.css`.
The generated file is committed and CI runs the generator followed by
`git diff --exit-code` on it.

**Why:** Types, contrast tests and runtime all read the same definitions. A
theme that omits a token fails compilation; a stale generated stylesheet fails
CI. Generation is deterministic, so no runtime generator or extra network
request is needed.

## ADR-002 — Bridge semantic tokens into the existing app before rewriting it

**Decision:** Generated themes write both `--hf-*` tokens and the existing
`--color-*`, `--radius-*`, `--shadow-*`, shadcn HSL and `--mk-*` variables.

**Why:** The app already consumes the legacy semantic variables in thousands of
places. Bridging lets every existing surface re-skin immediately while new work
uses the typed `token()` accessor. The bridge is migration scaffolding, not a
second styling paradigm.

## ADR-003 — Persistence: localStorage + cookie, legacy migration, Auto fallback

**Decision:** Preference key/cookie is `hf-theme`. The server reads the cookie
to render `data-theme` before first paint. The pre-paint script also resolves
Auto from `prefers-color-scheme`. The old `hisaflow.theme` value (`light`/`dark`)
is read once and migrated to `ivory`/`carbon`; corrupt values fall back to
Auto.

**Why:** Cookie-driven SSR avoids a flash of the wrong theme; localStorage keeps
the client fast. `suppressHydrationWarning` on `<html>` is the documented React
escape hatch for the pre-paint attribute mutation. Cross-tab `storage` events
keep multiple open tabs in sync.

## ADR-004 — Auto maps to Ivory/Carbon

**Decision:** Auto follows the OS mode and resolves to `ivory` when light and
`carbon` when dark. Explicit named themes always win.

**Why:** It gives existing users the expected light/dark result without taking
away the six named experiences.

## ADR-005 — Shape and depth are tokenised; density scales rem spacing and type

**Decision:** `--hf-radius-*` and `--hf-shadow-*` drive Tailwind’s radius/shadow
utilities and shared primitives. Tailwind’s spacing scale remains rem-based, and
each theme sets `--hf-font-size-base` on `<html>`; Carbon/Midnight therefore
become compact, contrast/Ivory stay roomy. Touch-target tokens remain ≥44px.

**Why:** It changes the _feel_ globally without branching components on theme
IDs. Ivory resolves to the old 4/8/12/16/24/32/48 spacing values, so the default
experience does not shift.

## ADR-006 — Contrast thresholds are enforced in the package test suite

**Decision:** Tests assert body/secondary/muted text ≥4.5:1 (≥7:1 for Contrast),
accent foregrounds ≥4.5:1, focus rings/strong borders ≥3:1, status colours on
their surfaces ≥4.5:1 and against the main surface ≥3:1, and chart series ≥3:1.

**Why:** The hex values are starting points; the tests are the authority. A
token change that breaks readability turns CI red.

## ADR-007 — Workspace precedence and wallpaper scrim

**Decision:** Precedence is `theme tokens → workspace defaults → per-widget
overrides`. `WorkspaceBackdrop` overlays `--hf-workspace-scrim` on wallpaper.
Changing the theme never resets a layout; workspace reset never changes the
theme.

**Why:** Themes are the base layer and customisation must remain independent.
The scrim makes wallpaper legible under all six themes without coupling widget
surfaces to one artwork.

## ADR-008 — Print/export is always Ivory

**Decision:** Generated CSS contains an `@media print` block that pins the core
tokens to the Ivory palette.

**Why:** Invoices, receipts and printed views must be neutral and readable
regardless of the user's on-screen theme.

## ADR-009 — No runtime dependencies; no new styling paradigm

**Decision:** The theme package has zero runtime dependencies and consumes only
Tailwind/CSS variables already in the app. No CSS-in-JS package or second
component library was introduced.

## ADR-010 — Picker is an accessible radiogroup on its own Appearance route

**Decision:** Settings → Appearance (`/settings/appearance`) renders Auto + six
theme cards with scoped live previews, check-icon selected state, arrow-key
navigation and roving focus. The shell links directly to this screen from the
top bar, desktop rail, mobile side menu and Settings. The separate light/dark
toggle was removed so the named theme is the only appearance control.

**Why:** It matches the directive’s picker brief and works at both mobile and PC
breakpoints (2 columns on phones, 3–4 on wider screens).

## ADR-011 — Legacy text utilities are bridged to semantic tokens

**Decision:** Inside themed app shells (`data-hf-app`), legacy Tailwind text
colours are remapped to semantic tokens: neutral shades to
`text.primary/secondary/muted`, status families to `status.*`, and
purple/violet/pink to the accent. Solid accent/status backgrounds also receive
the theme's accent foreground, and their white child text is corrected. Hover
variants follow the same mapping. Dark variants (`dark:text-*`) carry a
different class token and keep their explicit values.

**Why:** Hundreds of existing screens use literal utility colours. Mapping them
centrally makes every named theme readable without a risky component-by-
component rewrite. The bridge is intentionally scoped to themed shells so the
fixed-dark admin view-as screen and other deliberate dark surfaces keep their
own palette. `lib/theme-text-bridge.spec.ts` guards the mechanism.

**Exit:** Remove the bridge once the raw-literal migration backlog in
`AUDIT.md` reaches zero.
