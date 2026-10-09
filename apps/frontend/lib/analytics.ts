/**
 * Consent-aware analytics scaffold (`hisaflow-landing-page.md` Sections 5.5 and
 * 7, Layer L-A).
 *
 * No vendor is chosen yet and no tracking ships by default: `track()` is a
 * no-op unless BOTH (a) the visitor has granted consent and (b) an endpoint is
 * configured via `NEXT_PUBLIC_ANALYTICS_ENDPOINT`. This keeps the Kenya DPA
 * consent requirement front and centre and avoids shipping a third-party
 * processor before that decision is made.
 */

export const FUNNEL_EVENTS = [
  'landing_view',
  'cta_click',
  'signup_started',
  'signup_completed',
  'onboarding_completed',
  'trial_active',
  'paywall_viewed',
  'checkout_started',
  'payment_succeeded',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export type FunnelProperties = Record<string, string | number | boolean | null>;

const CONSENT_KEY = 'hf:analytics_consent';

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (granted) {
      window.localStorage.setItem(CONSENT_KEY, 'granted');
    } else {
      window.localStorage.removeItem(CONSENT_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); treat as no consent.
  }
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT);
}

/** Emits a funnel event only when consent is granted and a sink exists. */
export function track(event: FunnelEvent, properties: FunnelProperties = {}): void {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent() || !isAnalyticsConfigured()) return;

  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT as string;
  const payload = JSON.stringify({
    event,
    properties,
    path: window.location.pathname,
    referrer: document.referrer || null,
    ts: Date.now(),
  });

  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, payload);
    } else {
      void fetch(endpoint, {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    // Analytics must never break the page.
  }
}
