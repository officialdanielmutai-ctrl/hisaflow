import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// globals are disabled in vitest.config.ts, so register cleanup explicitly.
afterEach(() => {
  cleanup();
});
