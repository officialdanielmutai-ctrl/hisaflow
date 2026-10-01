import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma.service';
import { FEATURES_KEY } from '../decorators/requires-features.decorator';
import { TierFeature } from '../entitlements/entitlements.constant';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { RolesGuard } from './roles.guard';

function context(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'user_1' },
        headers: { 'x-organization-id': 'org_1' },
        method: 'PATCH',
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard tier dimension (Phase D)', () => {
  function build(assertFeatures?: jest.Mock) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === FEATURES_KEY ? [TierFeature.RolePermissions] : undefined,
      ),
    };
    const prisma = {
      db: {
        orgMembership: {
          findFirst: jest.fn(async () => ({
            role: 'OWNER',
            grantedPermissions: [],
            revokedPermissions: [],
          })),
        },
      },
    };
    const entitlements = {
      assertFeatures: assertFeatures ?? jest.fn(async () => ({})),
    };
    const guard = new RolesGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
      entitlements as unknown as EntitlementsService,
    );
    return { guard, entitlements };
  }

  it('runs the entitlement check for @RequiresFeatures on an existing member', async () => {
    const { guard, entitlements } = build();

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(entitlements.assertFeatures).toHaveBeenCalledWith('org_1', [
      TierFeature.RolePermissions,
    ]);
  });

  it('propagates the feature lock so the client can route to the paywall', async () => {
    const assertFeatures = jest.fn(async () => {
      throw new Error('Feature Locked');
    });
    const { guard } = build(assertFeatures);

    await expect(guard.canActivate(context())).rejects.toThrow('Feature Locked');
  });

  it('returns true when no role/permission/feature metadata is present', async () => {
    const reflector = { getAllAndOverride: jest.fn(() => undefined) };
    const guard = new RolesGuard(
      reflector as unknown as Reflector,
      {} as unknown as PrismaService,
      {} as unknown as EntitlementsService,
    );

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});
