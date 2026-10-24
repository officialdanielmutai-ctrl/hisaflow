import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { FeatureLockedException } from '../../core/entitlements/feature-locked.exception'
import { EntitlementsService } from '../../core/entitlements/entitlements.service'
import { PrismaService } from '../../infrastructure/prisma.service'
import { OrganizationsRepository } from './organizations.repository'
import { OrganizationsService } from './organizations.service'
import { BusinessType } from './dto/create-organization.dto'
import { MAX_LOGO_DATA_URL_LENGTH } from './branding.constants'

function build(assertSeatAvailable: jest.Mock) {
  const orgMembershipCreate = jest.fn(async () => ({}))
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
  }
  const entitlements = {
    assertSeatAvailable,
    syncSeatCount: jest.fn(async () => 1),
  }

  const service = new OrganizationsService(
    {} as unknown as OrganizationsRepository,
    prisma as unknown as PrismaService,
    entitlements as unknown as EntitlementsService
  )

  return { service, orgMembershipCreate, entitlements }
}

describe('OrganizationsService seat gate (Phase D)', () => {
  it('creates the membership and syncs the seat count when a seat is available', async () => {
    const assertSeatAvailable = jest.fn(async () => ({
      allowed: true,
      overage: 0,
      autoBilled: false,
    }))
    const { service, orgMembershipCreate, entitlements } =
      build(assertSeatAvailable)

    await service.joinOrganization('ABC123', 'user_2')

    expect(orgMembershipCreate).toHaveBeenCalledWith({
      data: { userId: 'user_2', organizationId: 'org_1', role: 'STAFF' },
    })
    expect(entitlements.syncSeatCount).toHaveBeenCalledWith('org_1')
  })

  it('does not create the membership when the seat gate locks', async () => {
    const assertSeatAvailable = jest.fn(async () => {
      throw new FeatureLockedException({
        reason: 'seat_limit',
        feature: 'staff',
        requiredTier: 'TEAM',
        currentTier: 'SOLO',
        message: 'No seat',
      })
    })
    const { service, orgMembershipCreate } = build(assertSeatAvailable)

    await expect(
      service.joinOrganization('ABC123', 'user_2')
    ).rejects.toBeInstanceOf(FeatureLockedException)
    expect(orgMembershipCreate).not.toHaveBeenCalled()
  })
})

describe('OrganizationsService plan preference (Phase L-D)', () => {
  function buildCreate() {
    const repoCreate = jest.fn(async (data: Record<string, unknown>) => ({
      id: 'org_1',
      ...data,
    }))
    const prisma = {
      db: {
        organization: { update: jest.fn(async () => ({})) },
        orgMembership: { create: jest.fn(async () => ({})) },
      },
    }
    const service = new OrganizationsService(
      { create: repoCreate } as unknown as OrganizationsRepository,
      prisma as unknown as PrismaService,
      {} as unknown as EntitlementsService
    )
    return { service, repoCreate }
  }

  it('stores plan intent as an advisory preference only', async () => {
    const { service, repoCreate } = buildCreate()

    await service.create(
      {
        name: 'Mama Njeri Duka',
        businessType: BusinessType.DUKA,
        preferredPlan: 'TEAM',
      },
      'user_1'
    )

    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ preferredPlan: 'TEAM' })
    )
  })

  it('defaults to null when no valid intent is supplied', async () => {
    const { service, repoCreate } = buildCreate()

    await service.create(
      { name: 'Mama Njeri Duka', businessType: BusinessType.DUKA },
      'user_1'
    )

    expect(repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ preferredPlan: null })
    )
  })
})

describe('OrganizationsService branding', () => {
  function buildBranding(
    opts: {
      membership?: Record<string, unknown> | null
      updated?: Record<string, unknown>
      updateError?: Error
    } = {}
  ) {
    const findFirst = jest.fn(async () => opts.membership ?? null)
    const update = jest.fn(
      async ({ data }: { data: Record<string, unknown> }) => {
        if (opts.updateError) throw opts.updateError
        return { id: 'org_1', name: 'Acme', ...data, ...opts.updated }
      }
    )
    const prisma = {
      db: {
        orgMembership: { findFirst },
        organization: { update },
      },
    }
    const service = new OrganizationsService(
      {} as unknown as OrganizationsRepository,
      prisma as unknown as PrismaService,
      {} as unknown as EntitlementsService
    )
    return { service, findFirst, update }
  }

  it('lets an owner set a public logo URL', async () => {
    const { service, update } = buildBranding({ membership: { role: 'OWNER' } })

    const result = await service.updateBranding(
      'user_1',
      'org_1',
      'https://cdn.example.com/logo.png'
    )

    expect(update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { logoUrl: 'https://cdn.example.com/logo.png' },
    })
    expect(result).toMatchObject({
      logoUrl: 'https://cdn.example.com/logo.png',
    })
  })

  it('lets an owner upload a compressed image data URL', async () => {
    const { service, update } = buildBranding({ membership: { role: 'OWNER' } })
    const dataUrl = `data:image/png;base64,${Buffer.from('logo').toString(
      'base64'
    )}`

    const result = await service.updateBranding('user_1', 'org_1', dataUrl)

    expect(update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { logoUrl: dataUrl },
    })
    expect(result).toMatchObject({ logoUrl: dataUrl })
  })

  it('rejects malformed, non-image, and oversized data URLs', async () => {
    const { service, update } = buildBranding({ membership: { role: 'OWNER' } })

    await expect(
      service.updateBranding(
        'user_1',
        'org_1',
        'data:image/svg+xml;base64,AAAA'
      )
    ).rejects.toThrow(BadRequestException)
    await expect(
      service.updateBranding('user_1', 'org_1', 'data:image/png;base64,%%%%')
    ).rejects.toThrow(BadRequestException)
    await expect(
      service.updateBranding(
        'user_1',
        'org_1',
        `data:image/png;base64,${'A'.repeat(MAX_LOGO_DATA_URL_LENGTH)}`
      )
    ).rejects.toThrow(BadRequestException)
    expect(update).not.toHaveBeenCalled()
  })

  it('lets a manager clear the override to fall back to email/monogram', async () => {
    const { service, update } = buildBranding({
      membership: { role: 'MANAGER' },
    })

    await service.updateBranding('user_1', 'org_1', '   ')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      data: { logoUrl: null },
    })
  })

  it('rejects staff and non-members', async () => {
    const { service, update } = buildBranding({ membership: null })

    await expect(
      service.updateBranding('user_1', 'org_1', 'https://example.com/logo.png')
    ).rejects.toThrow(ForbiddenException)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects malformed and non-http URLs', async () => {
    const { service, update } = buildBranding({ membership: { role: 'OWNER' } })

    await expect(
      service.updateBranding('user_1', 'org_1', 'not-a-url')
    ).rejects.toThrow(BadRequestException)
    await expect(
      service.updateBranding('user_1', 'org_1', 'ftp://example.com/logo.png')
    ).rejects.toThrow(BadRequestException)
    expect(update).not.toHaveBeenCalled()
  })
})
