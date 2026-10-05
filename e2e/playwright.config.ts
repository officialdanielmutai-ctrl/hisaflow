import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests for the critical journeys only.
 *
 * This workspace is intentionally isolated from apps/backend and apps/frontend
 * so it can never import their source. It runs against a *seeded* environment;
 * point E2E_BASE_URL at it (never production or a shared dev database).
 *
 *   E2E_BASE_URL=https://staging.example.com \
 *   E2E_STORAGE_STATE=./e2e/.auth/owner.json \
 *   E2E_STAFF_STORAGE_STATE=./e2e/.auth/staff.json \
 *   E2E_ORG_NAME="Acme Ltd" \
 *   pnpm test:e2e
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: process.env.E2E_STORAGE_STATE || undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
