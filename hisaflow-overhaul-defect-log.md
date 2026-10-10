# HisaFlow — Quality & Assistant Overhaul: Defect Log

Format per `hisaflow-quality-and-assistant-overhaul.md` Section 1.6:
`ID · Duty · Vertical/Service · Screen/Endpoint · Viewport/State · Description · Severity · Root cause · Fix PR · Regression guard · Status`

| ID | Duty | Vertical/Service | Screen/Endpoint | Viewport/State | Description | Severity | Root cause | Fix PR | Regression guard | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Q-001 | D1 | ISP | `/dashboard` KPI cards (`IspDashboard.tsx`) | all, loaded | `h-4.5 w-4.5` on the 4 KPI icon tiles are not valid Tailwind v3 utilities, so the icons render at the 24px lucide default instead of 18px; header icon/label baselines differ from the rest of the app where `h-4`/`h-5` are used. | Sev3 | Invalid v3 utility classes (config is Tailwind 3.4.19); hand-built per-vertical cards. | util fix | `lib/tailwind-utility-guard.spec.ts` (repo-wide ban) | Fixed |
| Q-002 | D1 | ISP | `/dashboard` KPI cards (`IspDashboard.tsx`) | all, loaded | `shadow-xs` / `shadow-2xs` are Tailwind v4 utilities and are no-ops in v3, so card elevation is inconsistent with the token shadow scale. Same class also in `app/(dashboard)/work-orders/page.tsx`. | Sev4 | Invalid v3 utility classes. | util fix | `lib/tailwind-utility-guard.spec.ts` (repo-wide ban) | Fixed |
| Q-003 | D1 | All verticals | KPI rows (ISP, chemist, restaurant, school, wholesale, guest house, retail) | all | KPI/stat cards are hand-built per vertical, so alignment/padding/wrapping fixes do not propagate; only `OperationalSummary` is shared and it is unused by the KPI rows. | Sev3 | No shared card component (overhaul Section 2.5). | — | — | Logged |
| Q-004 | D1 | ISP | `/dashboard` KPI cards | all, loaded | Tier-1 headers use an `ArrowUpRight` affordance; Tier-2 headers use a status pill — the two rows' header heights/baselines differ by construction. | Sev3 | Inconsistent header slot treatment across the same KPI row. | — | — | Logged |

**Severity key:** Sev1 data/security/outage/AI-unauthorised-write · Sev2 broken flow or misleading numbers/overflow · Sev3 visible non-blocking misalignment · Sev4 polish.
