/**
 * Failure types the VSCU/KRA boundary distinguishes (tax-system doc Section 7
 * item 4). The sync service maps these to the two defaulted paths:
 *
 * - `VscuConnectionError` — no response at all (device offline / bridge
 *   unreachable). On transmission this is the silent-queue path.
 * - `VscuApiError` — a real error response (HTTP error, or a KRA `resultCd`
 *   other than `000`). This is the backoff-and-alert path, because a prolonged
 *   KRA outage affects many orgs and must be visible.
 */

export class VscuConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VscuConnectionError';
  }
}

export class VscuApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'VscuApiError';
    this.code = code;
  }
}
