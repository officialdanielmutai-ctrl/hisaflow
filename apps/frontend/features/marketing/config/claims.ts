/**
 * Claims flags for the public landing page.
 *
 * Rule (`hisaflow-landing-page.md` Section 6): a capability claim ships only
 * when it is live in production. Copy is gated on this config so a claim can be
 * turned on or off in one place without touching components.
 */

export type ClaimState = 'live' | 'coming_soon' | 'hidden';

export interface ClaimsConfig {
  /** M-Pesa and card payments via Paystack. */
  mpesaPayments: ClaimState;
  /** Automatic KRA eTIMS-compliant invoicing. */
  taxEtims: ClaimState;
  /** Working offline / on poor internet. */
  offlineMode: ClaimState;
  /** Vertical modules. */
  shops: ClaimState;
  guestHouses: ClaimState;
  isps: ClaimState;
  schools: ClaimState;
  /**
   * Whether third-party payment logos may be shown. Text-only until each
   * brand's usage guidelines are confirmed.
   */
  paymentLogosPermitted: boolean;
}

export const CLAIMS: ClaimsConfig = {
  // Paystack card + M-Pesa checkout is shipped (paywall Phases B to E).
  mpesaPayments: 'live',
  // Tax system is built and tested; production KRA eTIMS activation is not yet
  // verified, so it is honestly labelled rather than claimed as live.
  taxEtims: 'coming_soon',
  offlineMode: 'hidden',
  shops: 'live',
  guestHouses: 'live',
  isps: 'live',
  schools: 'live',
  paymentLogosPermitted: false,
};

export function isLive(state: ClaimState): boolean {
  return state === 'live';
}

export function isVisible(state: ClaimState): boolean {
  return state !== 'hidden';
}
