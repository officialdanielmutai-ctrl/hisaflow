import { expect, type Page } from '@playwright/test';

/**
 * Shared KPI geometry measurement (overhaul Duty 1, Section 2.3).
 *
 * Used by `kpi-layout-lab.spec.ts` (all verticals, no auth) and
 * `dashboard-layout.spec.ts` (the real authenticated app). Both must apply the
 * same rules, so the logic lives here once.
 */

export const KPI_VIEWPORTS = [360, 390, 768, 1024, 1280, 1440, 1920] as const;

export interface RowMetrics {
  /** Number of grid tracks, so single-column stacks are not treated as a row. */
  columns: number;
  heights: number[];
  valueTops: number[];
  overflows: number[];
}

export async function measureKpiRows(page: Page): Promise<RowMetrics[]> {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="stat-card"]'),
    );
    const groups = new Map<HTMLElement, RowMetrics>();
    for (const card of nodes) {
      const row = card.parentElement;
      if (!row) continue;
      const group = groups.get(row) ?? {
        columns: getComputedStyle(row).gridTemplateColumns
          .split(' ')
          .filter(Boolean).length,
        heights: [],
        valueTops: [],
        overflows: [],
      };
      group.heights.push(card.getBoundingClientRect().height);
      group.overflows.push(card.scrollWidth - card.clientWidth);
      const value = card.querySelector<HTMLElement>('[data-stat-value]');
      // Loading skeletons have no value; they are compared by height only.
      if (value) {
        group.valueTops.push(
          value.getBoundingClientRect().top -
            row.getBoundingClientRect().top,
        );
      }
      groups.set(row, group);
    }
    return [...groups.values()].filter((group) => group.heights.length > 1);
  });
}

export function assertKpiGeometry(rows: RowMetrics[]): void {
  for (const row of rows) {
    // Every card is a touch target and none may overflow its own box.
    for (const height of row.heights) {
      expect(height).toBeGreaterThanOrEqual(44);
    }
    for (const overflow of row.overflows) {
      expect(overflow).toBeLessThanOrEqual(1);
    }
    // Alignment is only meaningful when the cards share a visual row (the grid
    // collapses to one column below `sm`).
    if (row.columns < 2) continue;
    const height = row.heights[0];
    for (const h of row.heights) {
      expect(Math.abs(h - height)).toBeLessThanOrEqual(1);
    }
    const valueTop = row.valueTops[0];
    for (const top of row.valueTops) {
      expect(Math.abs(top - valueTop)).toBeLessThanOrEqual(1);
    }
  }
}

export async function assertNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
