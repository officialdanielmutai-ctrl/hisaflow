import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { assertNoPageOverflow } from './helpers/kpi-geometry';

/**
 * Duty 1 screen sweep against the seeded local app (overhaul Section 2.2).
 *
 * Runs the real authenticated UI for one organisation per business type and
 * walks each vertical's routable screens at a mobile (390) and a desktop
 * (1280) width. It fails on a non-200 page, a Next.js error overlay, or a
 * horizontally scrolling page, and writes a full-page screenshot per cell for
 * the human review pass. The KPI-card geometry is measured separately by
 * `kpi-layout-lab.spec.ts` / `dashboard-layout.spec.ts`.
 *
 * Requires the seeded e2e harness (`e2e/playwright.duty1.config.ts`), which
 * sets the active org through `localStorage` and authenticates with the
 * test-only backend guard.
 */
interface SeedOrg {
  id: string;
  name: string;
  businessType: string;
}

const seed = JSON.parse(
  readFileSync(resolve(__dirname, '../.auth/seed.json'), 'utf8'),
) as Record<string, SeedOrg>;

const COMMON = [
  '/dashboard',
  '/inventory',
  '/transactions',
  '/finance',
  '/alerts',
  '/notes',
  '/assistant',
  '/settings',
];

const VERTICAL_SCREENS: Record<string, string[]> = {
  DUKA: COMMON,
  MINI_MART: COMMON,
  CHEMIST: COMMON,
  WHOLESALER: COMMON,
  RESTAURANT: [...COMMON, '/table-orders'],
  SCHOOL: [
    '/dashboard',
    '/students',
    '/school-classes',
    '/school-fees',
    '/transactions',
    '/finance',
    '/alerts',
    '/notes',
    '/settings',
  ],
  GUEST_HOUSE: [
    '/dashboard',
    '/bookings',
    '/guests',
    '/rooms',
    '/transactions',
    '/finance',
    '/alerts',
    '/notes',
    '/settings',
  ],
  ISP: [
    '/dashboard',
    '/subscribers',
    '/service-plans',
    '/tickets',
    '/work-orders',
    '/transactions',
    '/finance',
    '/alerts',
    '/notes',
    '/settings',
  ],
};

const WIDTHS = [390, 1280];

test.skip(
  Object.keys(seed).length === 0,
  'Run the Duty 1 seed first (e2e/playwright.duty1.config.ts runs it automatically).',
);

for (const [vertical, routes] of Object.entries(VERTICAL_SCREENS)) {
  test.describe(`${vertical} screens`, () => {
    for (const route of routes) {
      for (const width of WIDTHS) {
        test(`${route} @ ${width}px`, async ({ page }, testInfo) => {
          const org = seed[vertical];
          expect(org, `seed has ${vertical}`).toBeTruthy();

          await page.setViewportSize({ width, height: 1000 });
          await page.context().addInitScript(
            (id) => window.localStorage.setItem('hf:active_org_id', id),
            org.id,
          );

          const response = await page.goto(route, {
            waitUntil: 'domcontentloaded',
          });
          expect(response?.status(), `${route} responded`).toBeLessThan(400);

          // Let the client data settle (SWR + skeletons).
          await page.waitForTimeout(2500);

          await expect(
            page.locator('[data-nextjs-dialog]'),
            `${route} has no error overlay`,
          ).toHaveCount(0);
          await assertNoPageOverflow(page);

          await page.screenshot({
            path: testInfo.outputPath(
              `${vertical}${route.replace(/\//g, '_')}-${width}.png`,
            ),
            fullPage: true,
          });
        });
      }
    }
  });
}
