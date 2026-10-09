import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FUNNEL_EVENTS,
  hasAnalyticsConsent,
  isAnalyticsConfigured,
  setAnalyticsConsent,
  track,
} from './analytics';

describe('analytics consent gate (Layer L-A)', () => {
  const sendBeacon = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    sendBeacon.mockClear();
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    vi.unstubAllEnvs();
  });

  it('exposes the full funnel event list', () => {
    expect(FUNNEL_EVENTS).toContain('landing_view');
    expect(FUNNEL_EVENTS).toContain('checkout_started');
    expect(FUNNEL_EVENTS).toContain('payment_succeeded');
  });

  it('ships no tracking without consent', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENDPOINT', 'https://analytics.example/collect');

    expect(hasAnalyticsConsent()).toBe(false);
    track('landing_view');
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('ships no tracking without a configured sink even with consent', () => {
    setAnalyticsConsent(true);
    expect(isAnalyticsConfigured()).toBe(false);

    track('landing_view');
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('sends a funnel event only with both consent and a sink', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENDPOINT', 'https://analytics.example/collect');
    setAnalyticsConsent(true);

    track('cta_click', { placement: 'hero' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [endpoint, body] = sendBeacon.mock.calls[0];
    expect(endpoint).toBe('https://analytics.example/collect');
    expect(JSON.parse(body)).toMatchObject({
      event: 'cta_click',
      properties: { placement: 'hero' },
    });
  });

  it('revoking consent stops further sends', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENDPOINT', 'https://analytics.example/collect');
    setAnalyticsConsent(true);
    track('landing_view');
    setAnalyticsConsent(false);
    track('landing_view');

    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
