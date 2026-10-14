import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Seeds the local test Postgres before the Duty 1 sweep. The seed truncates
 * every application table, creates one org per business type (all owned by the
 * synthetic `e2e-owner` user), and writes `e2e/.auth/seed.json`.
 */
export default function globalSetup(): void {
  const backendDir = resolve(__dirname, '../apps/backend');
  execSync('npx ts-node --transpile-only test/e2e-seed.ts', {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, E2E_AUTH_BYPASS: 'true' },
  });
}
