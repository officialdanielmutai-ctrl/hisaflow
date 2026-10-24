# Theme work — found issues (log only)

These are observations made while building the theme system. They are not
silently fixed in this change unless explicitly noted.

## F-T01 — Repo-wide lint warning baseline

- **Where:** `pnpm lint` across backend/frontend/admin.
- **Issue:** the repo has 0 errors but hundreds of pre-existing warnings
  (`no-explicit-any`, unused imports, legacy hook dependencies). The directive’s
  “0 warnings” gate cannot be made true without a separate cleanup PR.
- **Action:** new theme code is clean under the repo lint, but the global
  warning baseline remains. Do not lower `--max-warnings`; fix warnings in a
  dedicated migration.

## F-T02 — Legacy `.dark` block remains in `globals.css`

- **Where:** `apps/frontend/app/globals.css`.
- **Issue:** the old hand-written light/dark token block is still present for
  fallback and for the existing `dark-contrast.spec.ts` guard. Generated
  `html[data-theme]` rules override it, but it is duplicated source.
- **Action:** remove the legacy block once all consumers read `--hf-*` and the
  dark-contrast guard is migrated to the theme package.

## F-T03 — Hard-coded colour backlog

- **Where:** primarily `apps/frontend/components` (about 164 raw literals),
  plus smaller counts in app/features/lib/admin. 57 files still use legacy
  `bg-white`/`gray` utilities.
- **Issue:** many of those files do not yet consume semantic tokens directly.
  The central bridge maps legacy neutral/status text inside themed shells to
  tested tokens, gives solid accent/status controls the theme's accent
  foreground, and maps pale status panels plus fixed near-white surfaces onto
  theme surfaces in dark themes, so readability is protected while the
  migration continues.
- **Action:** migrate in slices (shell, forms, tables, cards, sheets, charts,
  verticals, assistant) and remove the bridge once the count is zero.

## F-T04 — Marketing mesh tokens are only partially theme-aware

- **Where:** `globals.css` marketing section.
- **Issue:** core canvas/surface/ink/accent variables follow the theme, but the
  decorative mesh pastels/ink radials are still fixed per-mode values.
- **Action:** if marketing should fully follow themes, generate per-theme mesh
  values in a later design pass.

## F-T05 — PWA manifest cannot follow the runtime theme

- **Where:** `public/manifest.json`.
- **Issue:** manifest `theme_color`/`background_color` are static. The runtime
  meta theme-color follows the selected theme, but the install splash/manifest
  colour uses the Ivory defaults.
- **Action:** accept the static default or generate per-theme manifests if a
  product requirement appears.

## F-T06 — No Playwright visual/across-theme matrix yet

- **Where:** e2e suite is seeded/nightly and the directive’s visual matrix +
  axe scan was not added in this pass.
- **Action:** add a seeded Playwright matrix for key screens × six themes ×
  mobile/desktop after the environment/baselines are available.

## F-T07 — Theme cookie makes routes dynamic

- **Where:** `app/layout.tsx` now awaits `cookies()`.
- **Impact:** routes that were statically prerendered now render dynamically so
  the first HTML can carry the correct theme. This is expected for no-flash
  cookie-driven SSR; review when performance budgets are next measured.

## F-T08 — Vercel install refused `workspace:*` (resolved)

- **Where:** Vercel deployment from commit `0a0bbe4`.
- **Issue:** the Vercel project installs from `apps/frontend` with npm;
  `"@hisaflow/theme": "workspace:*"` produced `EUNSUPPORTEDPROTOCOL`, so the
  deployment never reached the build.
- **Resolution:** the dependency now uses
  `file:../../packages/theme`, which npm accepts from either `apps/frontend`
  or the repo root. A root `vercel.json` also pins pnpm when the project is
  configured at the repo root. The generated theme CSS is committed, so the
  build does not depend on a package-manager-specific postinstall step.
