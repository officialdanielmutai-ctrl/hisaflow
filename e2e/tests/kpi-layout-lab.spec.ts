import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import {
  KPI_VIEWPORTS,
  assertKpiGeometry,
  assertNoPageOverflow,
  measureKpiRows,
} from './helpers/kpi-geometry';

/**
 * Measured KPI geometry across every vertical (overhaul Duty 1, Section 2.3).
 *
 * Unlike `dashboard-layout.spec.ts`, which needs a logged-in seeded org, this
 * runs against the public, dev-only KPI layout lab and so can measure all
 * eight vertical arrangements plus the card states at every Section 2.2
 * viewport — with synthetic adversarial data, no auth, no customer data. It
 * fails on unequal heights, misaligned values, overflow, sub-44px targets or a
 * horizontally scrolling page, and writes screenshots for the human review.
 *
 * Without `E2E_KPI_LAB_URL` (a lab-enabled deployment, i.e.
 * `NEXT_PUBLIC_ENABLE_GALLERY=true`) it skips, so the scheduled staging e2e
 * run — where the dev-only route 404s — stays green.
 */
const LAB_URL = process.env.E2E_KPI_LAB_URL ?? '';
test.skip(
  !LAB_URL,
  'Set E2E_KPI_LAB_URL to a lab-enabled deployment to run the KPI layout lab.',
);

const ARTIFACTS = resolve(__dirname, '../artifacts');

test.beforeAll(() => {
  mkdirSync(ARTIFACTS, { recursive: true });
});

for (const width of KPI_VIEWPORTS) {
  test(`KPI lab geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(LAB_URL);
    await page
      .locator('[data-testid="stat-card"]')
      .first()
      .waitFor({ state: 'visible' });

    const rows = await measureKpiRows(page);
    expect(rows.length, 'KPI rows render').toBeGreaterThan(0);
    assertKpiGeometry(rows);
    await assertNoPageOverflow(page);

    // States row: loading/empty/error/default must keep equal dimensions.
    const stateCards = page.locator(
      '[data-vertical="states"] [data-testid="stat-card"]',
    );
    await expect(stateCards).toHaveCount(4);
    const stateBoxes = await stateCards.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
    for (const box of stateBoxes) {
      expect(Math.abs(box - stateBoxes[0])).toBeLessThanOrEqual(1);
    }

    await page.screenshot({
      path: resolve(ARTIFACTS, `kpi-${width}.png`),
      fullPage: true,
    });
  });
}

test('KPI lab survives 200% browser zoom at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(LAB_URL);
  await page
    .locator('[data-testid="stat-card"]')
    .first()
    .waitFor({ state: 'visible' });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%';
  });

  assertKpiGeometry(await measureKpiRows(page));
  await assertNoPageOverflow(page);
  await page.screenshot({
    path: resolve(ARTIFACTS, 'kpi-zoom-200.png'),
    fullPage: true,
  });
});

test('KPI lab survives increased text size at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(LAB_URL);
  await page
    .locator('[data-testid="stat-card"]')
    .first()
    .waitFor({ state: 'visible' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
  });

  assertKpiGeometry(await measureKpiRows(page));
  await assertNoPageOverflow(page);
  await page.screenshot({
    path: resolve(ARTIFACTS, 'kpi-text-20px.png'),
    fullPage: true,
  });
});
