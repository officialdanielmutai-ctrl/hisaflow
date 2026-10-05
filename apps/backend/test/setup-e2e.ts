import { config } from 'dotenv';
import { resolve } from 'path';

// Load the committed, test-only environment *before* any Nest module is
// imported. dotenv does not override variables already provided by the
// environment, so a CI workflow can point DATABASE_URL at its Postgres
// service container and win over the file.
config({ path: resolve(__dirname, '..', '.env.test') });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for e2e tests. Expected apps/backend/.env.test or a workflow-provided env var.',
  );
}
