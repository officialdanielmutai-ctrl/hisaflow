# HisaFlow theme system

Named themes (`ivory`, `carbon`, `savanna`, `midnight`, `lagoon`, `contrast`)
change colour, shape, depth, density, type and motion together.

## Architecture

- `packages/theme/src/types.ts` — contract and `ThemeId` union.
- `packages/theme/src/themes.ts` — the six definitions (the only source of
  truth for theme values).
- `packages/theme/src/generate.ts` — deterministic CSS generator.
- `apps/frontend/app/theme-tokens.generated.css` — committed generated output.
- `apps/frontend/components/providers/ThemeProvider.tsx` — runtime preference,
  persistence, no-flash adoption, cross-tab/system listeners.
- `apps/frontend/components/settings/ThemePicker.tsx` — Appearance picker.
- `apps/frontend/app/(dashboard)/settings/appearance/page.tsx` — picker screen.
- Entry points: palette button in `TopBar` (mobile + PC), palette button in
  `DesktopSidebar`, Appearance item in `SideMenu`, and the Settings row.

Token naming: `--hf-<group>-<token>` (for example `--hf-bg-surface`,
`--hf-radius-lg`, `--hf-motion-duration-base`). TypeScript should call
`token('bg.surface')` rather than writing variable strings.

## Add a seventh theme in under 10 steps

1. Add the new id to `THEME_IDS` in `packages/theme/src/types.ts`.
2. Add a complete `ThemeDefinition` object to `themes` in
   `packages/theme/src/themes.ts` (the `satisfies Record<ThemeId, …>` makes a
   missing token a compile error).
3. Choose `mode: 'light' | 'dark'`, name, description and icon stroke.
4. Define every colour token, including 8 chart series and status surfaces.
5. Define shape, depth, density, typography and motion tokens.
6. Run `pnpm --filter @hisaflow/theme generate` to refresh the generated CSS.
7. Run `pnpm --filter @hisaflow/theme test`; fix any contrast failure by
   tuning the definition, never by lowering a threshold.
8. If it is a new default for a mode, update `DEFAULT_LIGHT`/`DEFAULT_DARK`.
9. Run `pnpm --filter frontend exec tsc --noEmit -p tsconfig.json`,
   `pnpm --filter frontend test`, and `pnpm --filter frontend build`.
10. Update `DECISIONS.md`/`AUDIT.md` if the addition changes an architectural
    assumption.

No picker change is needed: the picker maps over the registry.

## Commands

```bash
pnpm --filter @hisaflow/theme build        # compile the contract package
pnpm --filter @hisaflow/theme generate     # regenerate committed CSS
pnpm --filter @hisaflow/theme test         # token, contrast and drift checks
pnpm theme:check                           # test + generate + git diff guard
pnpm format:check                          # new theme files/docs
```

## Storage and first paint

- Preference key/cookie: `hf-theme` (`auto` or a theme id).
- Legacy `hisaflow.theme` values (`light`/`dark`) migrate to Ivory/Carbon.
- The server reads the cookie and renders `data-theme`; a tiny inline script
  resolves Auto (OS dark) before first paint.
- Corrupt/blocked storage falls back safely to Auto.

## Accessibility

- Every colour pair used for body text meets AA; Contrast meets AAA body text.
- Text tokens are also tested on every common themed surface (canvas, card,
  raised, elevated, tinted and status surfaces).
- Legacy utility text colours inside the app shell are bridged to those same
  semantic tokens, including solid accent/status backgrounds and hover states.
- Status colours are tested on their surfaces; status meaning must keep an icon
  or text cue.
- Reduced motion zeroes motion tokens and legacy animation durations.
- Focus rings use per-theme width/offset/colour; Contrast uses 4px rings.
- The picker is a labelled radiogroup with arrow-key navigation and a
  check-icon selected state (not colour-only).

## Print

`@media print` pins the core tokens to Ivory so invoices, receipts and exported
views stay neutral regardless of the active theme.

## Baselines and visual regression

There is no committed Playwright visual baseline yet (see
`FOUND_ISSUES.md` F-T06). When adding it, store baselines by
`theme × viewport × route`, document tolerance, and regenerate only with an
intentional design change. Do not update baselines to hide a regression.
