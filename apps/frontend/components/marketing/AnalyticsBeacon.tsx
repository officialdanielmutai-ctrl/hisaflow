'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Fires the top-of-funnel `landing_view` event on mount. `track` is a no-op
 * unless the visitor has consented and an analytics endpoint is configured, so
 * this never sends anything by default.
 */
export function AnalyticsBeacon() {
  useEffect(() => {
    track('landing_view');
  }, []);

  return null;
}
