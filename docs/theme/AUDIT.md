# Theme system — Layer 0 audit

**Date:** 2026-10-23
**Scope:** Read-only discovery of the styling stack and the theme migration
backlog. Implementation decisions are recorded in `DECISIONS.md`; unrelated
findings are in `FOUND_ISSUES.md`.

## 1. Workspace and tooling

| Item            | Reality in the repo                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package manager | **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packageManager: pnpm@11.2.2`). Root `workspaces` also exists, but pnpm is the canonical runner used by CI and the scripts. |
| Monorepo        | `apps/frontend`, `apps/backend`, `apps/admin`, `apps/gateway`, `packages/types`, and the new `packages/theme`.                                                                 |
| Frontend        | Next.js **15.2.8**, App Router, React 18, TypeScript strict.                                                                                                                   |
| Styling         | Tailwind CSS 3.4 with design-token CSS custom properties in `apps/frontend/app/globals.css`. `components/ui/*` is shadcn/radix-style TSX.                                      |
| Dark mode       | A manual `.dark` class plus `hisaflow.theme` localStorage key in `lib/theme.ts`. No named themes, no cookie/no-flash SSR, no shape/depth/density variation.                    |
| CI              | `.github/workflows/ci.yml`: typecheck, lint, backend tests, backend e2e, frontend tests, admin tests, build. It did not check generated theme CSS or theme formatting.         |
| Root tasks      | `build`, `dev`, `lint`, `format`; now also `typecheck`, `test`, `format:check`, `theme:check`.                                                                                 |

## 2. Layout reality (PC + mobile)

- The mobile shell uses a fixed `TopBar`, `SideMenu`, and `BottomNav`.
- The PC shell adds `DesktopSidebar` at the `lg` breakpoint and a wider bento
  dashboard, while the same route remains the mobile dashboard below `lg`.
- Theme work therefore targets the shared CSS variables and shared shell
  primitives, not a single breakpoint. The picker uses 2 columns on phones and
  3–4 columns on wider screens.

## 3. Where colours, shape and depth currently live

- `globals.css` owns the existing semantic variables (`--color-*`, `--radius-*`,
  `--shadow-*`, shadcn HSL channels, marketing tokens).
- Tailwind maps semantic utility names (`bg-bg-surface`, `text-text-primary`,
  `border-border`, `shadow-sm`, `rounded-2xl`, etc.) onto those variables.
- The raw-literal inventory (excluding tests and generated/theme package files)
  is approximately:

| Area                       |                                                 Raw colour/mode literals |
| -------------------------- | -----------------------------------------------------------------------: |
| `apps/frontend/app`        |                                                                       17 |
| `apps/frontend/components` |                                                                      164 |
| `apps/frontend/features`   |                                                                       14 |
| `apps/frontend/lib`        | 121 (mostly the legacy dark-contrast test and marketing/library helpers) |
| `apps/admin`               |                                                                       18 |
| `apps/backend/src`         |                                                                        0 |

- 57 frontend files still contain legacy `bg-white`, `bg-gray-*`,
  `text-gray-*`, or `border-gray-*` utilities. A dark-mode bridge in
  `globals.css` remaps the common cases; the bridge is part of the migration
  backlog.
- The most visible remaining literals in the shell are the bento hero cards,
  the gauge/sparkline palettes, and the shadcn component vendor files.

## 4. Existing theme-adjacent assets

- **Charts:** Recharts (`revenue`, analytics bar chart) plus hand-drawn SVG
  sparklines/gauges. Several series colours were hard-coded; the primary chart
  and gauge/sparkline paths now read the generated `--hf-chart-*` palette.
- **PWA:** `public/manifest.json` and the root `viewport` exported a fixed
  `theme_color`. The manifest now defaults to Ivory; the runtime provider
  updates `<meta name="theme-color">` per theme.
- **Print/PDF/invoices:** invoice views use the shared CSS variables. The
  generated stylesheet pins `@media print` to the Ivory palette so exports stay
  neutral/light.
- **Verticals:** guest house, school, ISP, retail, wholesale, restaurant and
  chemist all share `StatCard` / `DashboardKpiRows` and the same shell tokens.
  Themes therefore apply vertical-agnostically.

## 5. Workspace customisation overlap

- `hooks/useWorkspace.tsx` stores per-user layout, per-widget style, accent,
  transparency/blur and wallpaper presets in `user_workspaces`.
- The workspace uses its own curated accent/surface values and `theme.mode` via
  the resolved light/dark mode. Named themes now form the base layer:
  - a theme change does **not** touch layouts or per-widget overrides;
  - workspace reset does **not** change the selected theme;
  - `WorkspaceBackdrop` layers the theme's `--hf-workspace-scrim` over wallpaper
    so text keeps its contrast budget.
- Deeper precedence (`theme → workspace defaults → per-widget override`) is
  documented in `DECISIONS.md` and remains compatible with the current storage.

## 6. Baseline gate status at audit time

| Gate                    | Status                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Theme CSS generation    | New: deterministic generator + committed stylesheet                                             |
| Theme package typecheck | Pass (strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)                        |
| Theme tests             | Pass (12 contract/contrast/generation tests)                                                    |
| Frontend typecheck      | Pass                                                                                            |
| Frontend tests          | Pass (43 files / 269 tests)                                                                     |
| Frontend build          | Pass                                                                                            |
| Backend tests/build     | Pass at baseline                                                                                |
| Repo lint               | 0 errors, but **pre-existing warnings** remain; see `FOUND_ISSUES.md`                           |
| Formatting              | `format:check` now covers new theme package/docs; the legacy repo is not fully Prettier-clean   |
| CI                      | Workflow extended with theme typecheck, format check, theme tests and generated-CSS drift check |
