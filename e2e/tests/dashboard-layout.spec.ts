import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  KPI_VIEWPORTS,
  assertKpiGeometry,
  assertNoPageOverflow,
  measureKpiRows,
} from './helpers/kpi-geometry';

/**
 * Measured KPI geometry in the real authenticated app (overhaul Duty 1,
 * Section 2.3/2.5).
 *
 * The unit tests cover the `StatCard` contract in jsdom, which cannot measure
 * layout. This spec is the measured guard for a seeded staging organisation
 * (the same harness as the other e2e journeys): it loads the org's dashboard
 * at every Section 2.2 viewport and fails if the shared card drifts — unequal
 * heights, misaligned values, overflow or a touch target under 44px.
 *
 * Without `E2E_BASE_URL` it skips, matching the repo's existing e2e pattern so
 * the default CI build stays green; the always-on guards for the specific
 * defect that was reported are the Tailwind utility guard and the `StatCard`
 * unit/arrangement specs. The no-auth equivalent across all verticals is
 * `kpi-layout-lab.spec.ts`.
 */
const hasEnv = Boolean(process.env.E2E_BASE_URL);
test.skip(!hasEnv, 'Set E2E_BASE_URL to a seeded test environment to run layout checks.');

// When the local seeded harness is present (Duty 1 sweep), select the same
// deterministic active organisation the sweep uses. Against staging the file
// does not exist and the real Clerk storageState + org selection apply.
const SEED_PATH = resolve(__dirname, '../.auth/seed.json');
const seed = existsSync(SEED_PATH)
  ? (JSON.parse(readFileSync(SEED_PATH, 'utf8')) as Record<
      string,
      { id: string }
    >)
  : null;

test.beforeEach(async ({ context }) => {
  if (!seed) return;
  const firstOrg = Object.values(seed)[0];
  if (!firstOrg) return;
  await context.addInitScript(
    (id) => window.localStorage.setItem('hf:active_org_id', id),
    firstOrg.id,
  );
});

for (const width of KPI_VIEWPORTS) {
  test(`dashboard KPI geometry at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/dashboard');
    await page
      .locator('[data-testid="stat-card"]')
      .first()
      .waitFor({ state: 'visible' });

    const rows = await measureKpiRows(page);
    expect(rows.length, 'at least one KPI row renders').toBeGreaterThan(0);
    assertKpiGeometry(rows);
    await assertNoPageOverflow(page);

    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
      fullPage: true,
    });
  });
}

test('dashboard survives 200% browser zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/dashboard');
  await page
    .locator('[data-testid="stat-card"]')
    .first()
    .waitFor({ state: 'visible' });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%';
  });

  assertKpiGeometry(await measureKpiRows(page));
  await assertNoPageOverflow(page);
});
