import { test, expect } from '@playwright/test';

const hasEnv = Boolean(process.env.E2E_BASE_URL);

// Every journey below is a real assertion, but they require a seeded target
// environment. Without E2E_BASE_URL the whole file is skipped rather than
// failing, so the default CI build (no staging URL) stays green.
test.skip(!hasEnv, 'Set E2E_BASE_URL to a seeded test environment to run browser smoke tests.');

test.describe('public journeys', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Journey 1 (part A): the sign-up entry point is reachable and renders a form.
  test('sign-up page renders the auth form', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page).toHaveURL(/sign-up/);
    await expect(page.locator('input').first()).toBeVisible();
  });

  // Journey 1 (part B): the onboarding choice is reachable.
  test('onboarding offers create-or-join', async ({ page }) => {
    await page.goto('/onboarding');

    await expect(
      page.getByText(/setting up a new business or joining one/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /set up my business/i })).toBeVisible();
  });
});

test.describe('authenticated journeys', () => {
  // Journey 2: sign-in lands on a dashboard scoped to the seeded organisation.
  test('dashboard loads with the seeded organisation data', async ({ page }) => {
    const orgName = process.env.E2E_ORG_NAME;
    test.skip(!orgName, 'Set E2E_ORG_NAME to assert the dashboard org.');

    await page.goto('/');

    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(orgName!)).toBeVisible();
  });

  // Journey 3: create an inventory item and see it in the list.
  test('created inventory item appears in the inventory list', async ({ page }) => {
    const itemName = `E2E Item ${Date.now()}`;

    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();

    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible();

    await page.getByLabel(/^Name/).first().fill(itemName);
    await page.getByRole('button', { name: /add product|save|create/i }).click();

    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });
  });

  // Journey 4: a seeded booking's invoice shows its totals.
  test('invoice page shows the balance for a seeded booking', async ({ page }) => {
    const bookingId = process.env.E2E_BOOKING_ID;
    test.skip(!bookingId, 'Set E2E_BOOKING_ID to a seeded booking.');

    await page.goto(`/bookings/${bookingId}/invoice`);

    await expect(page.getByText('Subtotal')).toBeVisible();
    await expect(page.getByText('Balance Due')).toBeVisible();
  });

  // Journey 5: a staff member cannot see an owner-only management surface.
  test('staff cannot see owner-only team management', async ({ browser }) => {
    const staffState = process.env.E2E_STAFF_STORAGE_STATE;
    test.skip(!staffState, 'Set E2E_STAFF_STORAGE_STATE to a staff session.');

    const context = await browser.newContext({ storageState: staffState });
    const page = await context.newPage();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'App Settings' })).toBeVisible();
    await expect(page.getByText('Team Management')).toHaveCount(0);

    await context.close();
  });
});
