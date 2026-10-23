# HisaFlow — Theme System Build Directive

**Audience:** engineering agents working in `officialdanielmutai-ctrl/hisaflow`
**Mission:** Ship a named theme system (think Proton Mail's Carbon, Snow, etc.). When a user picks a theme, the **colours, surfaces, density, shape, depth and motion** of the whole app change together, so each theme has its own _feel_, not just a palette swap.

---

## 0. How you must work (read before touching code)

You are building this as a **senior engineer** would: slowly at the foundations, quickly on top of them.

1. **Layer by layer.** The work is split into numbered layers (Section 5). Each layer is built on the one beneath it. **Never start Layer N+1 until Layer N is merged and CI is green on `main`.**
2. **One layer = one branch = one PR.** Branch name: `theme/layer-N-short-name`. Small, reviewable commits inside it.
3. **Every layer must pass the full gate (Section 4) before it is considered done.** A layer that is "almost green" is red.
4. **Never weaken the gates to get green.** No loosening ESLint/TS configs, no `// @ts-ignore`, no `eslint-disable` without a written justification on the same line, no `.skip`/`.only` tests, no deleted tests, no lowered thresholds. If a gate is wrong, raise it in the PR description as a separate, explicit change, not a silent one.
5. **No behavioural changes outside scope.** Theming touches presentation. Business logic (inventory, invoices, bookings, AI assistant flow) must behave identically before and after. If you find a bug, log it in `docs/theme/FOUND_ISSUES.md` and keep going. Don't fix it inside a theme PR.
6. **Audit before you build.** You cannot see the whole repo from the outside, so Layer 0 exists to make you read it properly. Do not assume the styling stack, framework router, or component library. Discover them and write them down.
7. **Write down decisions.** Maintain `docs/theme/DECISIONS.md` (short ADR-style entries). Future agents must be able to understand _why_.

---

## 1. What is known about the repo (verify, don't trust)

From the repo root as of this directive:

- **Product:** mobile-first PWA: inventory + operational intelligence for Kenyan SMEs. Multiple business verticals (e.g. guest houses, schools, ISP/WISP) with per-vertical feature sets.
- **Monorepo:** `apps/*`, `packages/*` (currently `packages/types`, imported as `@hisaflow/types`), plus a `context/` folder.
- **Tooling visible at root:** `turbo`, `prettier`, `typescript ^5.4.5`, `.eslintrc.js`, `.prettierrc`, `tsconfig.json` (`strict: true`, `moduleResolution: bundler`, `isolatedModules`, `"plugins": [{ "name": "next" }]` → a **Next.js** frontend).
- **Root scripts:** only `build`, `dev`, `lint`, `format`. No `typecheck` or `test` script is visible at the root.
- **Things that look inconsistent (check in Layer 0):**
  - Root `package.json` declares `"workspaces"` **and** a `pnpm-workspace.yaml` exists. Confirm which package manager is canonical and that both agree.
  - No `.github/` directory is visible in the root listing. Confirm whether CI exists and what it runs. If it doesn't, Layer 0 creates it.
  - Stray root files (`page.tsx`, a PNG, `test_litellm.py`) look misplaced. **Do not move or delete them.** Note them in `FOUND_ISSUES.md` only.
- **Existing work you must not collide with:** a customisable OS-style workspace is planned/in progress (switchable layouts, add/remove widgets, wallpaper, per-widget colour and style). The theme system is the **base layer** that workspace customisation sits on top of. See Section 7.

---

## 2. Product intent: what "a theme" means in HisaFlow

A theme is a **complete, named experience**. It must change:

| Dimension       | What changes                                                                | Example contrast                                                        |
| --------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Colour**      | Backgrounds, surfaces, text, borders, accent, status colours, chart palette | Ivory (warm light) vs Carbon (graphite dark)                            |
| **Shape**       | Corner radius scale                                                         | Ivory soft/rounded, Carbon tighter/sharper                              |
| **Depth**       | Shadows vs borders vs flat                                                  | Ivory uses soft shadows; Carbon uses hairline borders and little shadow |
| **Density**     | Spacing and control heights                                                 | Carbon compact (power users); Ivory roomy                               |
| **Type**        | Weight/tracking tweaks, optionally font stack                               | Subtle. Must not break layout                                           |
| **Motion**      | Duration and easing                                                         | Calm vs snappy; always honours reduced-motion                           |
| **Iconography** | Stroke weight                                                               | Optional                                                                |

### Launch theme set

Build **six**, no more, until the system is proven. Names are product-facing and should stay short, like Proton's.

| ID         | Name     | Mode       | Character                                                                                         |
| ---------- | -------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `ivory`    | Ivory    | light      | Warm paper whites, soft shadows, rounded, roomy. **Default light.**                               |
| `carbon`   | Carbon   | dark       | Graphite, hairline borders, sharp, compact. **Default dark.**                                     |
| `savanna`  | Savanna  | light      | Earthy ochre/terracotta accents on warm sand. A local nod.                                        |
| `midnight` | Midnight | dark       | True-black OLED surfaces, saves battery on phones, high-chroma accent.                            |
| `lagoon`   | Lagoon   | dark       | Deep teal-blue, calm, medium density.                                                             |
| `contrast` | Contrast | light/dark | **Accessibility theme.** Meets WCAG AAA text contrast, thick focus rings, no reliance on shadows. |

Plus an **Auto** choice (follows OS light/dark and maps to `ivory`/`carbon` unless the user overrides). Auto is a _preference_, not a theme.

### Starting palettes (tune with the contrast tests in Layer 2)

These are starting points, not final values. **The contrast test suite is the authority**, not these hexes.

| Token             | Ivory     | Carbon    |
| ----------------- | --------- | --------- |
| `bg.canvas`       | `#FAF7F2` | `#14171A` |
| `bg.surface`      | `#FFFFFF` | `#1C2024` |
| `bg.raised`       | `#FFFFFF` | `#242A2F` |
| `text.primary`    | `#1C1B19` | `#E8EAEC` |
| `text.secondary`  | `#5C5850` | `#9AA3AB` |
| `border.subtle`   | `#E7E1D6` | `#2C3238` |
| `accent.default`  | `#2F6F5E` | `#5B9DF5` |
| `accent.onAccent` | `#FFFFFF` | `#0B1220` |

Note: the browser/PWA chrome colour in the repo today is a dark graphite. Carbon should feel native to that.

---

## 3. Architecture (non-negotiable principles)

1. **Single source of truth in TypeScript.** Themes are defined as typed objects in a dedicated package. CSS is **generated** from them. Nobody hand-writes theme CSS.
2. **Three token tiers:**
   - **Primitive** (raw values: `palette.sand.50`, `radius.4`). Never used by components directly.
   - **Semantic** (meaning: `bg.surface`, `text.secondary`, `accent.default`, `status.danger`). **Components only consume these.**
   - **Component** (optional, e.g. `table.row.hover`, `card.shadow`) only where a semantic token is not enough.
3. **Delivery via CSS custom properties** scoped by `data-theme="<id>"` on `<html>`, plus `color-scheme` set per theme so native form controls, scrollbars and autofill match.
4. **No flash of wrong theme.** The correct theme is applied **before first paint** (inline blocking script and/or cookie-driven SSR). Hydration must not mismatch.
5. **Type-safe everywhere.** `ThemeId` is a string-literal union derived from the registry. Adding a theme without defining **every** token must be a **compile error** (use `satisfies` and exhaustive checks), not a runtime surprise.
6. **Accessible by construction.** Contrast is verified by automated tests across every theme. A theme that fails cannot merge.
7. **Themes are independent of verticals.** A guest house owner and an ISP owner both pick from the same six themes. Vertical-specific UI reads the same semantic tokens.
8. **Print and exports stay neutral.** Invoices, receipts, PDFs and printable views render in a fixed light print palette regardless of theme.
9. **Respect the existing styling stack.** Layer 0 identifies it (Tailwind, CSS Modules, styled-components, etc.). Integrate with it (e.g. map Tailwind's theme to the CSS variables). Do **not** introduce a second styling paradigm.

---

## 4. The gate — every layer must pass ALL of this

Run locally **and** in CI. All commands run from the repo root through the package manager the repo actually uses (discover in Layer 0; `pnpm` shown below).

| #   | Check                    | Command (adapt names to repo)                 | Pass criteria                                                         |
| --- | ------------------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Format**               | `pnpm prettier --check .`                     | Zero diffs                                                            |
| 2   | **Lint**                 | `pnpm lint` (ESLint with `--max-warnings 0`)  | Zero errors, **zero warnings**                                        |
| 3   | **Type-check**           | `pnpm typecheck` (`tsc --noEmit` per package) | Zero errors under `strict`                                            |
| 4   | **Unit/component tests** | `pnpm test`                                   | All pass, no skipped tests, coverage on new code ≥ 90% lines/branches |
| 5   | **Build**                | `pnpm build`                                  | Succeeds for all apps/packages                                        |
| 6   | **CI**                   | GitHub Actions workflow on the PR             | Green, required status check                                          |
| 7   | **Layer-specific tests** | Defined per layer below                       | All pass                                                              |

### Strictness requirements

- All **new** packages/files compile with `strict: true` **plus** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Enable these in the new theme package's own `tsconfig` so existing code is not destabilised.
- ESLint: `@typescript-eslint` strict-type-checked rules, `no-explicit-any` = error, `consistent-type-imports`, `jsx-a11y` for UI layers, `react-hooks/exhaustive-deps` = error.
- **No `any`, no non-null assertions (`!`), no unchecked casts (`as X`)** in theme code. Use type guards and `satisfies`.
- If the repo's existing lint/type baseline is **not** already green, that is a **Layer 0 deliverable**, fixed in isolated commits that do nothing else.

### CI requirements (create or extend `.github/workflows/ci.yml`)

- Triggers: `pull_request` and `push` to `main`.
- Steps: checkout → set up Node (version pinned via `.nvmrc`/`engines`) → install with a **frozen lockfile** → format check → lint → typecheck → test (with coverage) → build.
- Cache the package-manager store and the Turborepo cache.
- Concurrency group cancels superseded runs on the same branch.
- After Layer 6: add a **Playwright** job (visual + a11y) that uploads failure artifacts (screenshots/diffs).
- Mark the workflow as a **required status check** on `main` (document this in the PR; branch protection is a repo-settings action for the owner).

Wire `typecheck` and `test` into `turbo.json` pipelines so `turbo run lint typecheck test build` is the single local command that mirrors CI.

---

## 5. The layers

For every layer, follow this loop: **read → plan (write it in the PR description) → build → run the full gate → self-review the diff → open PR → fix review → merge on green.** Each layer lists **Deliverables**, **Tests that must exist**, and **Exit criteria**.

---

### Layer 0 — Audit and green baseline _(no feature code)_

**Purpose:** Know the terrain; make sure the gates are real before we rely on them.

**Deliverables**

- `docs/theme/AUDIT.md` covering:
  - Package manager and workspace reality (npm workspaces vs pnpm) and the fix if they conflict.
  - Next.js version, router type (App Router vs Pages), React version.
  - Styling stack and how colours are currently defined (hardcoded hex? Tailwind config? CSS variables?).
  - Inventory of **every place a raw colour, shadow, radius or font is hard-coded** (counts per app/directory). This becomes the migration backlog for Layer 4.
  - Existing dark-mode handling, if any.
  - PWA manifest and `theme-color` handling.
  - Charts/data-viz libraries and how they are coloured.
  - Print/PDF/invoice rendering paths.
  - Current lint/type/test/CI status, i.e. what runs, what's missing, what's red.
  - How verticals (guest house, school, ISP) share or fork UI components.
  - Where the planned OS-style workspace (widgets, wallpaper) stores its customisation and which colours it owns.
- `docs/theme/FOUND_ISSUES.md` (misplaced root files, anything weird, **log only**).
- Add missing `typecheck` and `test` scripts and Turborepo tasks; add the CI workflow if absent; get `main` green.
- Add a test runner appropriate to the stack (match what exists; if nothing, Vitest + Testing Library) with one smoke test proving the pipeline works.

**Exit criteria:** Full gate green on an otherwise unchanged app. `AUDIT.md` reviewed.

---

### Layer 1 — Theme contract (types and registry)

**Purpose:** The typed foundation. Nothing visual yet.

**Deliverables**

- New package `packages/theme` (name `@hisaflow/theme`), with its own strict `tsconfig`, lint config extending the root, and test setup. Wire into `pnpm-workspace.yaml`/`workspaces` and the `paths` mapping in the root `tsconfig.json` consistent with how `@hisaflow/types` is done.
- Types:
  - `ThemeId` (union of the six IDs), `ThemeMode = 'light' | 'dark'`.
  - `ColorTokens`, `ShapeTokens`, `DepthTokens`, `DensityTokens`, `TypeTokens`, `MotionTokens` → composed into `ThemeDefinition`.
  - `ThemePreference = ThemeId | 'auto'`.
- A `themes` registry typed with `satisfies Record<ThemeId, ThemeDefinition>` so a missing theme or token fails compilation.
- Pure helper functions: `resolveTheme(preference, systemPrefersDark)`, `isThemeId(value: unknown)` (type guard), `DEFAULT_LIGHT`, `DEFAULT_DARK`.
- Brief tone/feel metadata per theme (`name`, `description`, `mode`) for the picker later.

**Tests**

- Every theme defines every token (runtime check mirroring the compile-time one).
- `resolveTheme` truth table (auto/light/dark/explicit × system pref).
- `isThemeId` rejects garbage, `null`, wrong-case strings, prototype keys (`__proto__`, `constructor`).
- Type-level tests (e.g. `tsd`/`expectTypeOf`) proving a missing token fails to compile.

**Exit criteria:** Gate green. Package has zero runtime dependencies.

---

### Layer 2 — Generation and contrast guarantees

**Purpose:** Turn definitions into CSS; make accessibility enforceable.

**Deliverables**

- A build-time generator (`packages/theme/scripts/generate-css.ts`) that emits one stylesheet with:
  - `:root { ... }` fallback (Ivory),
  - `[data-theme="<id>"] { --hf-... ; color-scheme: light|dark; }` for each theme.
- Naming convention: `--hf-<group>-<token>` (e.g. `--hf-bg-surface`, `--hf-radius-md`, `--hf-motion-duration-base`). Document it.
- Generated output is **deterministic** and is either committed with a CI check that it is up to date (`generate && git diff --exit-code`) or generated in the build, **pick one in an ADR** and enforce it.
- Typed token accessors (e.g. `token('bg.surface')` → `'var(--hf-bg-surface)'`) so TS code never writes raw variable strings.
- Integration with the existing styling stack (e.g. Tailwind theme extension mapping utilities to the variables).

**Tests**

- **Contrast suite:** for every theme, assert WCAG ratios on all declared foreground/background pairings: body text ≥ 4.5:1, large text and UI components/borders/focus rings ≥ 3:1, `contrast` theme text ≥ 7:1. Include status colours (`danger`, `warning`, `success`, `info`) on their backgrounds.
- Snapshot test of generated CSS.
- Test that every variable referenced by the accessor map exists in the generated CSS for all themes.

**Exit criteria:** Gate green. Changing any token to a failing contrast value turns CI red.

---

### Layer 3 — Runtime: provider, persistence, no-flash

**Purpose:** Make themes switchable and persistent without visual glitches.

**Deliverables**

- `ThemeProvider` + `useTheme()` returning `{ preference, resolved, setPreference }`.
- Storage: `localStorage` key `hf-theme` plus a **cookie** mirror (so the server can render the right theme). Validate on read with `isThemeId`. Corrupt or unknown values fall back safely to `auto`.
- **Pre-paint script** (tiny, inlined in the document head) that sets `data-theme` and `color-scheme` before first paint. Include system-preference resolution for `auto`.
- Server-side: read the cookie in the root layout so the first HTML already carries `data-theme`. No hydration mismatch warnings.
- Listen to `prefers-color-scheme` changes (when on Auto) and to the `storage` event (cross-tab sync).
- Update `<meta name="theme-color">` and PWA chrome colour to match the active theme's canvas colour.
- Safe when `localStorage` is unavailable (private mode, quota, blocked).

**Tests**

- Provider: default, set, persist, restore, corrupt storage, storage unavailable, cross-tab event, system-pref change on Auto.
- Pre-paint script unit-tested as a pure function (given storage + media query → attribute values).
- A Playwright check: load with each stored theme → `data-theme` is correct at first paint (no flash, no console hydration warnings).

**Exit criteria:** Gate green. Manually toggling a theme via `setPreference` re-skins the (still unmigrated) app root without reload.

---

### Layer 4 — Migrate existing UI onto tokens _(sliced, mechanical, zero behaviour change)_

**Purpose:** Make the real app obey the system. This is the largest layer, so it is **split into sub-PRs by surface**, driven by the backlog in `AUDIT.md`.

**Suggested slices (adjust to audit):** (a) app shell/navigation/layout, (b) form controls and buttons, (c) tables and lists, (d) cards/widgets/KPI cards, (e) modals/sheets/toasts, (f) charts and data-viz, (g) vertical-specific screens (guest house, school, ISP), (h) AI assistant surfaces.

**Rules**

- Replace raw colours/shadows/radii with semantic tokens. Components consume **semantic** tokens only.
- Add a **lint guard** in the **first** slice (`no-restricted-syntax` / a Stylelint rule / a Tailwind-arbitrary-colour ban, whichever fits the stack) that fails CI on new raw hex/rgb/hsl colour literals outside `packages/theme`. Migrated directories are enforced immediately; un-migrated ones sit on a shrinking allowlist file. **The allowlist may only shrink.**
- **Status colours must not rely on colour alone** (low stock, out of stock, overdue, paid/unpaid): keep or add an icon/text/shape cue.
- **Charts:** introduce a per-theme data-viz palette (≥ 8 distinguishable, colour-blind-safe series colours, with tested contrast against the chart surface).
- **Print/export:** pin invoices, receipts and PDFs to a fixed print palette that ignores `data-theme`.
- The ISP KPI-card alignment issue and any other layout bugs found in the UI audit are **not** fixed here. Log them. This layer changes colour/shape/depth only, not layout.

**Tests**

- Existing tests all still pass unmodified (if a test must change, explain why in the PR).
- A visual regression baseline (Playwright screenshots) of key screens in `ivory` for each slice **before** changes, proving Ivory looks the same afterwards (tolerance documented).
- Per slice: render key components under every theme in a test and assert no unresolved `var(--hf-*)` (missing token) via computed styles.

**Exit criteria:** Allowlist is empty (or contains only justified, documented exceptions). Switching to any theme re-skins the entire app with no leftover hard-coded colours.

---

### Layer 5 — "Feel" tokens: shape, depth, density, motion

**Purpose:** Make themes _feel_ different, not just look different.

**Deliverables**

- Shared primitives (Button, Input, Card, Table, Sheet/Modal, Badge, Tabs, Toast) read from `--hf-radius-*`, `--hf-shadow-*`, `--hf-border-width`, `--hf-space-*`/`--hf-control-height-*`, `--hf-motion-*`.
- Density affects padding, row height and control height. **Touch targets stay ≥ 44×44 px on mobile in every theme**, so Carbon's compactness applies to spacing and type, not hit areas.
- Motion tokens: duration and easing per theme; everything respects `prefers-reduced-motion` (durations collapse, no parallax or large transforms).
- Focus ring style per theme (thicker and higher-contrast in `contrast`).
- `forced-colors: active` (Windows high contrast) handled: borders and focus rings remain visible.

**Tests**

- Component tests assert computed radius/padding/shadow differ between `ivory` and `carbon` as the definitions specify.
- Touch-target size test (≥ 44px) for interactive primitives under every theme at a mobile viewport.
- Reduced-motion test: animations/transition durations resolve to ~0.
- No layout shift (CLS) when switching themes: assert key element bounding boxes do not move unexpectedly beyond what density tokens define.

**Exit criteria:** Same screen under Ivory and Carbon is obviously different in character (screenshots attached to the PR).

---

### Layer 6 — Theme picker UI

**Purpose:** The user-facing choice, in the Proton Mail spirit.

**Deliverables**

- Settings → **Appearance** screen: a grid of theme cards (Auto + six themes). Each card shows a **live miniature preview** (mini app shell rendered with that theme's tokens, scoped via a local `data-theme`) and the theme name.
- Selecting a card applies it **instantly** (no reload, no flash) and persists it.
- Selected state is clear and not colour-only (check icon + outline).
- Accessibility: implemented as a `radiogroup`; arrow-key navigation; visible focus; labelled; screen-reader announces the active theme; works with touch, keyboard and mouse.
- Mobile-first layout: 2 columns on phones, 3+ on wider screens.
- Reachable from settings and (optionally) a quick toggle in the user menu.

**Tests**

- Component tests: renders all themes, selection updates provider, keyboard navigation, ARIA roles/labels.
- Playwright: select each theme → `data-theme` updates, persists across reload, persists across tabs.
- `@axe-core/playwright` scan of the Appearance page under every theme: **zero violations**.

**Exit criteria:** Gate green, including the new Playwright CI job.

---

### Layer 7 — Integration with the workspace customisation layer

**Purpose:** Make themes and the customisable OS-style workspace (layouts, widgets, wallpaper, per-widget colour/style) work together instead of fighting.

**Precedence (document in an ADR):**
`Theme tokens` → `Workspace defaults (derived from theme)` → `User per-widget overrides`.

**Rules**

- Widgets default to theme tokens. A user's explicit widget colour/style is stored as an **override**, and overrides must be validated for contrast against the widget surface (warn or auto-adjust text colour when unreadable).
- **Wallpaper must be theme-aware:** supply a scrim/overlay token per theme so text and widgets stay legible on any wallpaper. Provide default wallpapers per theme.
- "Reset to default" in the workspace resets overrides but **keeps** the chosen theme (and vice versa: changing the theme does not wipe the user's layout or widget choices).
- If the workspace work isn't merged yet, ship the integration contract (types and tokens: `--hf-workspace-scrim`, `--hf-widget-*`) and tests against it, and note the dependency in the PR.

**Tests**

- Theme switch preserves layout/widget state.
- Reset leaves theme untouched.
- Override contrast validation unit tests.
- Visual check of wallpaper + widgets across all six themes.

---

### Layer 8 — Hardening, performance, rollout

**Deliverables**

- **Visual regression matrix** in CI: key screens × six themes × mobile and desktop viewports (use sensible tolerances; store baselines in-repo or as CI artifacts, document the update procedure).
- Full-app axe scan across themes on the main routes (dashboard, inventory, a vertical's core screen, invoice, settings).
- **Performance:** generated theme CSS size budget (assert in CI), no runtime style recalculation storms on switch, no extra network requests for themes, Lighthouse PWA/performance not regressed.
- **PWA:** `manifest` `theme_color`/`background_color` sensible for first install; offline app shell renders in the user's last theme.
- **Optional sync:** if a user profile/preferences endpoint exists, persist the preference server-side so the choice follows the user across devices. Local storage remains the fast path; the server is eventual. Validate input with a schema server-side. Skip this if there is no profile API yet and log it as a follow-up.
- **Analytics-free rollout:** ship behind a simple flag if desired; default stays Ivory/Carbon via Auto so existing users see a sensible result.
- `docs/theme/README.md`: how to add a theme in under 10 steps, token naming, how to run the contrast and visual suites, how to update baselines.

**Exit criteria:** Gate green; docs complete; adding a seventh theme in a throwaway branch requires editing **one** file and passes or fails CI correctly.

---

## 6. Definition of Done (paste into every PR)

```md
## Layer N — <name>

### What & why

<short>

### Gate

- [ ] prettier --check
- [ ] lint (0 errors, 0 warnings)
- [ ] typecheck (strict, 0 errors)
- [ ] tests pass, no skips, new-code coverage ≥ 90%
- [ ] build passes
- [ ] CI green (link run)
- [ ] layer-specific tests (listed in directive) pass

### Scope discipline

- [ ] No business-logic changes
- [ ] No gate weakened (configs unchanged, or change explained below)
- [ ] No `any`, `!`, `@ts-ignore`, or unjustified `eslint-disable`
- [ ] Unrelated findings logged in docs/theme/FOUND_ISSUES.md

### Decisions

<link to DECISIONS.md entries>

### Evidence

<screenshots / test output / contrast report>
```

---

## 7. Interplay with other in-flight work (stay in your lane)

- **UI layout audit / ISP KPI card misalignment:** separate workstream. Do not fix layout here, log and defer.
- **AI assistant redesign:** separate. Only restyle its surfaces with tokens (Layer 4h). No flow or payload changes.
- **Customisable workspace:** Layer 7 defines the contract. Coordinate via the ADR; do not rewrite their storage model.
- **Business-specificity model:** themes are global and vertical-agnostic by design.

---

## 8. Anti-patterns that will be rejected in review

- Hand-written theme CSS or per-component `if (theme === 'carbon')` branching. Use tokens.
- Components importing primitive palette values or hex codes.
- Theme state that causes a flash or hydration warning.
- A theme that only changes colours (every theme must differ in at least shape, depth and density as specified).
- Colour as the only status signal.
- Widening a layer's scope "while I'm here".
- Merging with a red or flaky check. Fix or quarantine with a tracked issue; never ignore.
- Silent changes to lint/type/CI configuration.

---

## 9. Order of operations (summary)

`L0 Audit + green baseline` → `L1 Contract` → `L2 Generation + contrast` → `L3 Runtime + no-flash` → `L4 Migration (sliced)` → `L5 Feel tokens` → `L6 Picker UI` → `L7 Workspace integration` → `L8 Hardening + docs`

Report at the end of each layer: what shipped, what you deliberately did not do, anything you found, and the link to the green CI run. Then stop and wait for the layer to be merged before beginning the next.

---

## 10. Implementation status (2026-10-23)

This pass implements the theme system in one integration branch so the PC and
mobile layouts ship together. The layer-by-layer merge cadence in Section 0 is
still the recommended process for future changes.

| Layer                   | Status          | Evidence                                                                                                                                                |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Audit                 | Done            | `docs/theme/AUDIT.md`, `FOUND_ISSUES.md`                                                                                                                |
| 1 Contract              | Done            | `packages/theme` with strict TS, typed registry, guards and `satisfies` completeness                                                                    |
| 2 Generation + contrast | Done            | deterministic generator, committed generated CSS, 12 contract/contrast/drift tests                                                                      |
| 3 Runtime + no-flash    | Done            | `ThemeProvider`, `hf-theme` localStorage + cookie, pre-paint script, system/cross-tab listeners, meta theme-color                                       |
| 4 Migration             | Partial, sliced | shell/tokens bridge, picker surfaces, StatCard hero, charts, gauges and sparklines migrated; raw-literal backlog logged in `AUDIT.md`/`FOUND_ISSUES.md` |
| 5 Feel tokens           | Done            | per-theme radius, shadow, border, density/font-size, motion, focus ring, icon stroke, reduced-motion guard                                              |
| 6 Picker UI             | Done            | `/settings/appearance`, Auto + six cards, live scoped previews, radiogroup/arrow keys, check-icon selection, responsive 2/3/4 columns                   |
| 7 Workspace integration | Contract done   | theme scrim on wallpaper, theme changes preserve layout/overrides, workspace reset preserves theme                                                      |
| 8 Hardening             | Partial         | theme CI checks and docs; visual matrix/axe job remains logged as F-T06                                                                                 |

### Shipped behaviour

- Named themes: Ivory, Carbon, Savanna, Midnight, Lagoon, Contrast.
- Auto follows OS light/dark and maps to Ivory/Carbon; explicit choice wins.
- Correct theme on first paint via cookie SSR + inline script; no hydration
  warning (documented `suppressHydrationWarning` on `<html>`).
- Settings → Appearance picker works on phones (2 columns) and PC (3–4).
- Theme changes persist across reload and tabs, and update the PWA chrome
  `theme-color`.
- Shape/depth/density/motion change together; reduced-motion and print are
  handled.

### Deliberately not done here

- Repo-wide raw-colour migration and the zero-warning lint baseline are logged,
  not silently changed.
- Playwright visual/axe matrix and per-theme manifest generation are follow-ups.

### Evidence

- `pnpm --filter @hisaflow/theme test` — 12/12 pass.
- `pnpm --filter frontend test` — 43 files / 269 tests pass.
- `pnpm --filter backend test` — 110 suites / 878 tests pass.
- `pnpm --filter admin test` — 12 tests pass.
- `pnpm typecheck` — 6/6 turbo tasks pass.
- `pnpm lint` — exit 0 (0 errors; pre-existing warning baseline logged in
  `docs/theme/FOUND_ISSUES.md` F-T01).
- `pnpm build` — 5/5 packages pass; frontend emits 39 routes including
  `/settings/appearance`.
- `pnpm theme:check` — contract tests, generation and generated-CSS drift pass.
- Docs: `docs/theme/README.md`, `AUDIT.md`, `DECISIONS.md`, `FOUND_ISSUES.md`.
