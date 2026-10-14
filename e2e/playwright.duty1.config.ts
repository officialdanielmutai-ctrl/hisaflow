import { defineConfig, devices } from '@playwright/test';

/**
 * Duty 1 verification config (local, test-only).
 *
 * Boots the test-only backend guard (`apps/backend/test/e2e-server.ts`) and a
 * frontend dev server with the Clerk stub alias, both enabled only by the
 * `E2E_AUTH_BYPASS` / `NEXT_PUBLIC_E2E_AUTH` flags. Seeds the database first
 * (`duty1.global-setup.ts`). This harness can never run in production: the
 * backend server refuses to start when `NODE_ENV=production`, the middleware
 * bypass is gated the same way, and the Clerk alias is only added when
 * `NEXT_PUBLIC_E2E_AUTH=true`.
 *
 * Run: pnpm exec playwright test --config=e2e/playwright.duty1.config.ts
 */
process.env.E2E_BASE_URL ??= 'http://localhost:3010';
process.env.E2E_KPI_LAB_URL ??= 'http://localhost:3010/gallery/kpi';

const FRONTEND_PORT = 3010;
const BACKEND_PORT = 3011;

export default defineConfig({
  testDir: './tests',
  testMatch: [
    'duty1-sweep.spec.ts',
    'dashboard-layout.spec.ts',
    'kpi-layout-lab.spec.ts',
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Isolated contexts make parallelism safe; keep it modest on a laptop.
  workers: 2,
  // Windows/OneDrive can transiently lock a screenshot between runs; retry once.
  // Geometry assertions are deterministic, so a retry does not hide a defect.
  retries: 1,
  // Keep generated output inside `e2e/` so the repo root stays clean and the
  // existing `.gitignore` (`e2e/test-results/`, `e2e/playwright-report/`) applies.
  outputDir: './test-results',
  globalSetup: './duty1.global-setup.ts',
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: [
    {
      command: 'cd ../apps/backend && npx ts-node --transpile-only test/e2e-server.ts',
      url: `http://localhost:${BACKEND_PORT}/`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: { E2E_AUTH_BYPASS: 'true', PORT: String(BACKEND_PORT) },
    },
    {
      command: `cd ../apps/frontend && node -e "require('fs').rmSync('.next',{recursive:true,force:true})" && npx next dev -p ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}/dashboard`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_E2E_AUTH: 'true',
        E2E_AUTH_BYPASS: 'true',
        NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}`,
      },
    },
  ],
});
