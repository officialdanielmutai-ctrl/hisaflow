import { FeatureLockedException } from '../../core/entitlements/feature-locked.exception';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { PrismaService } from '../../infrastructure/prisma.service';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';
import { BusinessType } from './dto/create-organization.dto';

function build(assertSeatAvailable: jest.Mock) {
  const orgMembershipCreate = jest.fn(async () => ({}));
  const prisma = {
    db: {
      organization: {
        findUnique: jest.fn(async () => ({ id: 'org_1', name: 'Org' })),
      },
      orgMembership: {
        findFirst: jest.fn(async () => null),
        create: orgMembershipCreate,
      },
    },
  };
  const entitlements = {
    assertSeatAvailable,
    syncSeatCount: jest.fn(async () => 1),
  };

  const service = new OrganizationsService(
    {} as unknown as OrganizationsRepository,
    prisma as unknown as PrismaService,
    entitlements as unknown as EntitlementsService,
  );

  return { service, orgMembershipCreate, entitlements };
}

describe('OrganizationsService seat gate (Phase D)', () => {
  it('creates the membership and syncs the seat count when a seat is available', async () => {
    const assertSeatAvailable = jest.fn(async () => ({
      allowed: true,
      overage: 0,
      autoBilled: false,
    }));
    const { service, orgMembershipCreate, entitlements } =
      build(assertSeatAvailable);

    await service.joinOrganization('ABC123', 'user_2');

    expect(orgMembershipCreate).toHaveBeenCalledWith({
      data: { userId: 'user_2', organizationId: 'org_1', role: 'STAFF' },
    });
    expect(entitlements.syncSeatCount).toHaveBeenCalledWith('org_1');
  });

  it('does not create the membership when the seat gate locks', async () => {
    const assertSeatAvailable = jest.fn(async () => {
      throw new FeatureLockedException({
        reason: 'seat_limit',
        feature: 'staff',
        requiredTier: 'TEAM',
        currentTier: 'SOLO',
        message: 'No seat',
      });
    });
    const { service, orgMembershipCreate } = build(assertSeatAvailable);

    await expect(
      service.joinOrganization('ABC123', 'user_2'),
    ).rejects.toBeInstanceOf(FeatureLockedException);
    expect(orgMembershipCreate).not.toHaveBeenCalled();
  });
});

describe('OrganizationsService plan preference (Phase L-D)', () => {
  function buildCreate() {
    const repoCreate = jest.fn(
      async (data: Record<string, unknown>) => ({ id: 'org_1', ...data }),
    );
    const prisma = {
      db: {
        organization: { update: jest.fn(async () => ({})) },
        orgMembership: { create: jest.fn(async () => ({})) },
      },
    };
    const service = new OrganizationsService(
      { create: repoCreate } as unknown as OrganizationsRepository,
      prisma as unknown as PrismaService,
      {} as unknown as EntitlementsService,
    );
    return { service, repoCreate };
  }

  it('stores plan intent as an advisory preference only', async () => {
    const { service, repoCreate } = buildCreate();

    await service.create(
      { name: 'Mama Njeri Duka', businessType: BusinessType.DUKA, preferredPlan: 'TEAM' },
      'user_1',
    );

    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ preferredPlan: 'TEAM' }),
    );
  });

  it('defaults to null when no valid intent is supplied', async () => {
    const { service, repoCreate } = buildCreate();

    await service.create(
      { name: 'Mama Njeri Duka', businessType: BusinessType.DUKA },
      'user_1',
    );

    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ preferredPlan: null }),
    );
  });
});
