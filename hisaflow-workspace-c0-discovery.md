# HisaFlow — Workspace Customisation: Phase C-0 Discovery Report

**Status:** Complete (read-only). Owner instruction received to proceed to C-1.
**Date:** 2026-10-17.
**Directive:** `hisaflow-workspace-customisation.md` (this report satisfies Phase C-0; no code was changed while producing it).

---

## 1. How Home and widgets are built today

Home is `/dashboard` (`apps/frontend/app/(dashboard)/dashboard/page.tsx`). It chooses a
vertical dashboard component:

| Vertical | Component | KPI source |
|---|---|---|
| Retail / duka / mini-mart | `RetailDashboard` (in the page) | `RETAIL_KPI_ROWS`, `RETAIL_INVENTORY_ROWS` |
| Staff | `StaffDashboard` (in the page) | `STAFF_KPI_ROWS` |
| Guest house | `components/guesthouse/GuestHouseDashboard.tsx` | `GUEST_HOUSE_KPI_ROWS` |
| School | `components/school/SchoolDashboard.tsx` | `SCHOOL_KPI_ROWS` |
| Chemist | `components/chemist/ChemistDashboard.tsx` | `CHEMIST_KPI_ROWS` |
| Restaurant | `components/restaurant/RestaurantDashboard.tsx` | `RESTAURANT_KPI_ROWS` |
| Wholesale | `components/wholesale/WholesaleDashboard.tsx` | `WHOLESALE_KPI_ROWS` |
| ISP | `components/isp/IspDashboard.tsx` | `ISP_KPI_ROWS` |

All eight render their KPI area through the **same** `DashboardKpiRows`
(`apps/frontend/features/dashboard/DashboardKpiRows.tsx`). Each vertical supplies
`StatCardConfig<TData>[][]` from `features/dashboard/config/*.ts`: `id`, `label`,
icon, tone, href, `span` (1 or 2), and a `build(data)` that returns the card
content. `DashboardKpiRows` renders each row as a 2-column grid of the shared
`StatCard` (`components/system/StatCard.tsx`).

Everything **outside** the KPI rows (attention feed, inventory snapshot,
recommended actions, low-stock watch list, etc.) is hand-written JSX inside each
vertical dashboard and is out of scope for customisation.

**There is no widget abstraction, registry, grid layout, or persisted layout
today.** The KPI configs are the only reusable "widget" shape.

## 2. Existing libraries

- **No** drag/drop or grid-layout dependency is installed (`react-grid-layout`,
  `dnd-kit`, `framer-motion`, etc. are absent).
- Existing relevant libraries: SWR (data/fetching), vaul (bottom sheets),
  lucide-react (icons), browser-image-compression, @zxing/browser.
- Recommendation for C-1/C-2: **add no dependency**. The first customisation
  layer is a responsive 2-column CSS grid with preset sizes and explicit
  move/resize controls (including keyboard), which needs no new package. A
  free-form drag grid (and `dnd-kit`/`react-grid-layout`) should be evaluated
  only when precise drag-and-drop is implemented, per directive §9.1.

## 3. Existing preference storage and theming

- **Theme:** `components/providers/ThemeProvider.tsx` + `lib/theme.ts`. Manual
  light/dark, persisted in `localStorage` (`hisaflow.theme`), applied by toggling
  `.dark` on `<html>`; a no-flash bootstrap script runs in `app/layout.tsx`.
- **Organization:** `hooks/useMyOrganization.tsx` caches the active membership in
  `sessionStorage` and the active org id in `localStorage`.
- **No server-side user preference table exists.** The Prisma schema has no
  `UserPreference`/`Workspace` model. Preferences are currently device-local.
- Design tokens live in `app/globals.css` as CSS custom properties with a `.dark`
  override. `StatCard` surfaces use `var(--color-bg-surface)`, borders, tones.

## 4. PWA / offline

- Serwist service worker (`app/sw.ts`, `next.config.js`) with a runtime cache.
- SWR provider in the dashboard layout. No offline mutation queue for
  preferences; workspace edits must therefore save-on-Done to the server with a
  local cache for instant paint (directive §6).

## 5. Shared types

- `packages/types` exists but contains only a placeholder
  (`HisaflowSharedType`). It emits **declarations only** (`emitDeclarationOnly`)
  and is referenced by `apps/admin/next.config.js` `transpilePackages` but is not
  otherwise used.
- The root `tsconfig.json` already maps `@hisaflow/types` to
  `./packages/types/src`. App tsconfigs override `paths`, so each app that needs
  it must add the mapping (type-only imports).
- Recommendation: put the canonical `UserWorkspace`/layout/widget-instance types
  in `packages/types/src/index.ts` and consume them as **type-only** imports in
  the frontend and backend. No runtime import is needed (the package has no JS).

## 6. Design tokens and surfaces

- `globals.css` defines `--color-bg-base`, `--color-bg-surface`,
  `--color-bg-elevated`, `--color-border`, text/status/accent tokens, plus
  radius/shadow tokens. `.dark` remaps them.
- `StatCard` offers tone variants (`blue|emerald|amber|rose|neutral`) and a
  `compact` variant. These are the natural per-widget style hooks.

## 7. Tier-check mechanism

- `EntitlementsService` (`core/entitlements`, `@Global`) resolves the effective
  tier (`SOLO|TEAM|GROWTH`, defaulting to the Team trial when no subscription).
- Controllers use `@RequiresFeatures(...)` / `RolesGuard`; `useRole()` on the
  frontend exposes role/permission flags but no tier flag yet.
- Workspace layout limits can reuse `EntitlementsService.resolve()` directly in
  the workspace service (floor = 3 personal layouts, Team/Growth = unlimited up
  to the hard safety cap).

## 8. Baseline gates (last verified run)

| Gate | Result |
|---|---|
| Backend `tsc --noEmit` | Pass |
| Backend lint | 0 errors (warnings only) |
| Backend tests | 107 suites / 848 tests |
| Frontend `tsc --noEmit` | Pass |
| Frontend `next lint` | 0 errors (warnings only) |
| Frontend tests | 38 files / 207 tests |
| Admin typecheck / tests | Pass / 12 tests |
| E2E typecheck | Pass |
| `pnpm build` | 4/4 tasks |

## 9. Recommended smallest safe registry (for C-1)

1. **Registry = the existing KPI configs.** Add a thin
   `features/dashboard/registry.ts` that turns `StatCardConfig[][]` into
   `DashboardWidget[]` (`id`, title, description, category, supported sizes,
   default size, `multiInstance: false`, the original config). Renderers stay
   `StatCard`; nothing about what a widget shows changes.
2. **Extend `DashboardKpiRows` only when a saved workspace exists.** With no
   saved workspace it renders exactly as today (all widgets, original order and
   spans). With a saved layout it renders the ordered/visible/sized instances.
   This protects the existing geometry/e2e guarantees for non-customisers.
3. **Persist a compact, validated JSON workspace per (user, org)** in a new
   `user_workspaces` table (additive). Server is authoritative; a localStorage
   cache gives instant paint; save on **Done**.
4. **Breakpoint-keyed ordered instance lists for v1** (`order` + preset `size`)
   rather than free-form `x/y` coordinates. This is the smallest model that
   satisfies move/resize/reset with no overlap and no new grid dependency;
   free-form drag positioning is a later C-2 increment.
5. **Wrap every rendered widget in an error boundary**, validate on the server,
   drop unknown/unavailable widget ids gracefully, and fall back to the default
   layout on any failure.

## 10. Risks / decisions surfaced

- The directive's conceptual model uses `x/y` grid coordinates; the smallest
  safe C-1/C-2 model uses ordered flow + preset sizes. This is recorded here and
  in the tracker as a deliberate v1 constraint (free-form drag deferred).
- `packages/types` is declaration-only; shared types are consumed as `import
  type`. Validation constants/functions live in app code and are covered by
  tests on both sides.
- Wallpaper upload remains deferred (no storage decision), per directive §11.7.
- The Team-trial default means most orgs start with the Team layout limit until a
  plan is chosen; the service still enforces the floor limit for SOLO.
