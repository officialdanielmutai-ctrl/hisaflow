import { test, expect } from '@playwright/test';

/**
 * Assistant UI geometry guard (overhaul Duty 2 / Duty 1 Section 2.2).
 *
 * Runs against a seeded staging organisation (same harness as the other
 * e2e journeys). Skips without E2E_BASE_URL so the default CI build stays
 * green; the always-on guards live in the unit tests.
 */
const hasEnv = Boolean(process.env.E2E_BASE_URL);
test.skip(
  !hasEnv,
  'Set E2E_BASE_URL to a seeded test environment to run assistant layout checks.',
);

test.describe('assistant layout geometry', () => {
  test('no horizontal overflow and 44px touch targets', async ({ page }) => {
    await page.goto('/assistant');

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const send = page.getByRole('button', { name: 'Send message' });
    await expect(send).toBeVisible();
    const box = await send.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

    const proposalButtons = page.locator('[data-testid="proposal-card"] button');
    const count = await proposalButtons.count();
    for (let index = 0; index < count; index += 1) {
      const buttonBox = await proposalButtons.nth(index).boundingBox();
      if (buttonBox) {
        expect(buttonBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('proposal cards stay inside their container', async ({ page }) => {
    await page.goto('/assistant');
    const cards = page.locator('[data-testid="proposal-card"]');
    const count = await cards.count();
    for (let index = 0; index < count; index += 1) {
      const overflow = await cards.nth(index).evaluate(
        (node) => node.scrollWidth - node.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});
