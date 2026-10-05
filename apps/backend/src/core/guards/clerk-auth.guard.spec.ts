import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken } from '@clerk/backend';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ClerkAuthGuard } from './clerk-auth.guard';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

const verifyTokenMock = verifyToken as unknown as jest.Mock;
const createClerkClientMock = createClerkClient as unknown as jest.Mock;
const jwtVerifyMock = jwt.verify as unknown as jest.Mock;

interface Req {
  headers: Record<string, string>;
  method: string;
  user?: Record<string, unknown>;
}

function context(req: Req): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function build() {
  const user = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };
  const orgMembership = { findFirst: jest.fn() };
  const impersonationToken = { findUnique: jest.fn() };
  const db: any = { user, orgMembership, impersonationToken };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'clerk.secretKey') return 'sk_test_dummy';
      if (key === 'ADMIN_IMPERSONATION_SECRET') return 'imp-secret';
      return undefined;
    }),
  };
  const guard = new ClerkAuthGuard(
    config as unknown as ConfigService,
    { db } as unknown as PrismaService,
  );
  return { guard, user, orgMembership, impersonationToken };
}

beforeEach(() => {
  verifyTokenMock.mockReset();
  createClerkClientMock.mockReset();
  jwtVerifyMock.mockReset();
});

describe('ClerkAuthGuard — Clerk bearer tokens', () => {
  it('rejects a request with no Authorization header', async () => {
    const { guard } = build();

    await expect(guard.canActivate(context({ headers: {}, method: 'GET' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid Clerk token and attaches the org role from membership', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_1' });
    const { guard, user, orgMembership } = build();
    user.findUnique.mockResolvedValue({ id: 'user_1', name: 'Brian' });
    orgMembership.findFirst.mockResolvedValue({ role: 'OWNER' });
    const req: Req = {
      headers: { authorization: 'Bearer good-token', 'x-organization-id': 'org_a' },
      method: 'GET',
    };

    await expect(guard.canActivate(context(req))).resolves.toBe(true);

    expect(user.findUnique).toHaveBeenCalledWith({ where: { clerkId: 'clerk_1' } });
    expect(orgMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user_1', organizationId: 'org_a' },
      select: { role: true },
    });
    expect(req.user).toMatchObject({ id: 'user_1', clerkId: 'clerk_1', name: 'Brian', role: 'OWNER' });
  });

  it('backfills the display name from Clerk for a previously unseen user', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_2' });
    const { guard, user } = build();
    user.findUnique.mockResolvedValue(null);
    user.upsert.mockResolvedValue({ id: 'user_2', name: 'Jane Doe' });
    createClerkClientMock.mockReturnValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          firstName: 'Jane',
          lastName: 'Doe',
          emailAddresses: [{ emailAddress: 'jane@example.com' }],
        }),
      },
    });

    await guard.canActivate(
      context({ headers: { authorization: 'Bearer good-token' }, method: 'GET' }),
    );

    expect(user.upsert).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_2' },
      update: { name: 'Jane Doe', email: 'jane@example.com' },
      create: { clerkId: 'clerk_2', name: 'Jane Doe', email: 'jane@example.com' },
    });
  });

  it('still authenticates when the Clerk name lookup fails', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_3' });
    const { guard, user } = build();
    user.findUnique.mockResolvedValue(null);
    user.upsert.mockResolvedValue({ id: 'user_3', name: null });
    createClerkClientMock.mockReturnValue({
      users: { getUser: jest.fn().mockRejectedValue(new Error('clerk down')) },
    });

    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer good-token' }, method: 'GET' }),
      ),
    ).resolves.toBe(true);

    expect(user.upsert).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_3' },
      update: {},
      create: { clerkId: 'clerk_3' },
    });
  });

  it('rejects an invalid Clerk token', async () => {
    verifyTokenMock.mockRejectedValue(new Error('bad signature'));
    const { guard } = build();

    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer bad-token' }, method: 'GET' }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe('ClerkAuthGuard — admin view-as impersonation', () => {
  const impersonationPayload = {
    sub: 'imp_1',
    adminId: 'admin_1',
    adminName: 'Support Agent',
    targetOrgId: 'org_a',
    targetOrgName: 'Acme',
    readOnly: true,
  };

  it('allows a read-only request and forces the target org context', async () => {
    jwtVerifyMock.mockReturnValue(impersonationPayload);
    const { guard, impersonationToken } = build();
    impersonationToken.findUnique.mockResolvedValue({
      id: 'imp_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const req: Req = { headers: { 'x-impersonation-token': 'imp-token' }, method: 'GET' };

    await expect(guard.canActivate(context(req))).resolves.toBe(true);

    expect(req.headers['x-organization-id']).toBe('org_a');
    expect(req.user).toMatchObject({
      id: 'admin_1',
      isImpersonated: true,
      readOnly: true,
      targetOrgId: 'org_a',
      role: 'OWNER',
    });
  });

  it('blocks mutations in view-as mode', async () => {
    jwtVerifyMock.mockReturnValue(impersonationPayload);
    const { guard, impersonationToken } = build();
    impersonationToken.findUnique.mockResolvedValue({
      id: 'imp_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    // BUG (reported, not fixed): the guard throws ForbiddenException inside the
    // impersonation try/catch, which the catch re-wraps as Unauthorized. The
    // mutation is still denied; only the status code is wrong (401 vs 403).
    await expect(
      guard.canActivate(
        context({ headers: { 'x-impersonation-token': 'imp-token' }, method: 'POST' }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked impersonation session', async () => {
    jwtVerifyMock.mockReturnValue(impersonationPayload);
    const { guard, impersonationToken } = build();
    impersonationToken.findUnique.mockResolvedValue({
      id: 'imp_1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    // BUG (reported, not fixed): same swallowed-Forbidden path as above.
    await expect(
      guard.canActivate(
        context({ headers: { 'x-impersonation-token': 'imp-token' }, method: 'GET' }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid impersonation token instead of falling through', async () => {
    jwtVerifyMock.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const { guard } = build();

    await expect(
      guard.canActivate(
        context({ headers: { 'x-impersonation-token': 'bad-token' }, method: 'GET' }),
      ),
    ).rejects.toThrow('Invalid or expired impersonation token');
  });
});
