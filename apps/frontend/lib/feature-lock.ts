/**
 * Pure parser for the backend's structured tier/seat gate response
 * (`FeatureLockedException`, serialized by the global exception filter).
 *
 * Kept dependency-free so it can be unit-tested and reused by the API client,
 * which is the single place that turns the 403 into an in-context paywall
 * redirect (Section 2.1).
 */

export interface ResolvedFeatureLock {
  paywallUrl: string;
  message: string;
  feature?: string;
  reason?: string;
  requiredTier?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function resolveFeatureLock(
  body: Record<string, unknown> | null | undefined,
): ResolvedFeatureLock | null {
  if (!body) return null;

  const paywallUrl = asString(body.paywallUrl);
  if (!paywallUrl) return null;

  return {
    paywallUrl,
    message:
      asString(body.message) ??
      'This feature requires a plan upgrade.',
    feature: asString(body.feature),
    reason: asString(body.reason),
    requiredTier: asString(body.requiredTier),
  };
}

/** Reads `feature` and `reason` back out of a paywall URL. */
export function parsePaywallUrl(paywallUrl: string): {
  feature?: string;
  reason?: string;
} {
  try {
    const params = new URL(paywallUrl, 'https://app.hisaflow.com').searchParams;
    return {
      feature: params.get('feature') ?? undefined,
      reason: params.get('reason') ?? undefined,
    };
  } catch {
    return {};
  }
}
