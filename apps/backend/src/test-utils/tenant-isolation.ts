/**
 * Shared multi-tenant isolation helpers (Layer 1, priority 2).
 *
 * In a multi-tenant app the single most dangerous bug is a query that forgets
 * its `organizationId` scope. These helpers let a unit test prove, against a
 * mocked Prisma client, that (a) every DB call carries an org key and (b) no
 * row belonging to another org can be returned.
 */

/** Recursively collects every `organizationId` string found in a value. */
export function collectOrganizationIds(value: unknown, found: string[] = []): string[] {
  if (value == null) return found;
  if (typeof value === 'string') return found;
  if (Array.isArray(value)) {
    for (const entry of value) collectOrganizationIds(entry, found);
    return found;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'organizationId' && typeof entry === 'string') {
        found.push(entry);
      } else {
        collectOrganizationIds(entry, found);
      }
    }
  }
  return found;
}

/**
 * Asserts that *every* recorded call on a mocked Prisma delegate contains at
 * least one `organizationId` and that it always equals the caller's org.
 */
export function expectEveryCallScopedToOrg(mock: jest.Mock, orgId: string): void {
  expect(mock.mock.calls.length).toBeGreaterThan(0);
  for (const call of mock.mock.calls) {
    const ids = collectOrganizationIds(call);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toBe(orgId);
    }
  }
}

/**
 * Asserts a returned result set never contains a row owned by a foreign org.
 */
export function expectNoCrossOrgRows(result: unknown, orgId: string): void {
  const ids = collectOrganizationIds(result);
  for (const id of ids) {
    expect(id).toBe(orgId);
  }
}

/**
 * Builds a Prisma `findMany`-style mock that only ever returns rows for the
 * org named in `args.where.organizationId`. Rows for any other org are
 * unreachable, which is exactly the guarantee production must hold.
 */
export function tenantScopedFindMany<T extends Record<string, unknown>>(rows: T[]): jest.Mock {
  return jest.fn(async (args: { where?: { organizationId?: string } } = {}) => {
    const orgId = args.where?.organizationId;
    if (!orgId) return [];
    return rows.filter((row) => row.organizationId === orgId);
  });
}
