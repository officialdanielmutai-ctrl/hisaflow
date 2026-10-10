import { test, expect } from '@playwright/test';

/**
 * Shared KPI card geometry guard (overhaul Duty 1, Section 2.3/2.5).
 *
 * The unit tests cover the `StatCard` contract in jsdom, which cannot measure
 * layout. This spec is the measured guard: it runs against a seeded staging
 * organisation (the same harness as the other e2e journeys) and fails if the
 * shared card drifts — unequal heights, misaligned values, overflow, or a
 * touch target under 44px.
 *
 * Without `E2E_BASE_URL` it skips, matching the repo's existing e2e pattern so
 * the default CI build stays green; the always-on regression guard for the
 * specific defect that was reported is the Tailwind utility guard.
 */
const hasEnv = Boolean(process.env.E2E_BASE_URL);
test.skip(!hasEnv, 'Set E2E_BASE_URL to a seeded test environment to run layout checks.');

interface RowMetrics {
  heights: number[];
  valueTops: number[];
  overflows: number[];
}

async function kpiRows(page: import('@playwright/test').Page): Promise<RowMetrics[]> {
  const cards = page.locator('[data-testid="stat-card"]');
  await cards.first().waitFor({ state: 'visible' });

  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="stat-card"]'),
    );
    const groups = new Map<HTMLElement, RowMetrics>();
    for (const card of nodes) {
      const row = card.parentElement;
      if (!row) continue;
      const group = groups.get(row) ?? {
        heights: [],
        valueTops: [],
        overflows: [],
      };
      group.heights.push(card.getBoundingClientRect().height);
      group.overflows.push(card.scrollWidth - card.clientWidth);
      const value = card.querySelector<HTMLElement>('[data-stat-value]');
      // Relative to the row, so cards are compared within the same row.
      group.valueTops.push(
        value
          ? value.getBoundingClientRect().top - row.getBoundingClientRect().top
          : Number.NaN,
      );
      groups.set(row, group);
    }
    return [...groups.values()].filter((group) => group.heights.length > 1);
  });
}

test.describe('dashboard KPI card geometry', () => {
  test('cards in a row share height and value alignment without overflow', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const rows = await kpiRows(page);
    expect(rows.length, 'at least one KPI row renders').toBeGreaterThan(0);

    for (const row of rows) {
      const height = row.heights[0];
      for (const h of row.heights) {
        // Equal-height siblings.
        expect(Math.abs(h - height)).toBeLessThanOrEqual(1);
        // Mobile touch target.
        expect(h).toBeGreaterThanOrEqual(44);
      }
      // Value baselines line up across the row.
      const valueTop = row.valueTops[0];
      for (const top of row.valueTops) {
        expect(Math.abs(top - valueTop)).toBeLessThanOrEqual(1);
      }
      // No card content overflows its own box.
      for (const overflow of row.overflows) {
        expect(overflow).toBeLessThanOrEqual(1);
      }
    }
  });
});
