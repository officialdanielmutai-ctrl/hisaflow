import { PrismaService } from '../../infrastructure/prisma.service';
import { OrganizationsRepository } from './organizations.repository';

function build() {
  const organization: any = {
    create: jest.fn(async ({ data }: any) => ({ id: 'org_1', ...data })),
    findUnique: jest.fn(async () => ({ id: 'org_1', users: [] })),
  };
  const orgMembership: any = { findMany: jest.fn(async (): Promise<any[]> => []) };
  const db: any = { organization, orgMembership };
  return {
    repo: new OrganizationsRepository({ db } as unknown as PrismaService),
    organization,
    orgMembership,
  };
}

describe('OrganizationsRepository', () => {
  it('creates an organisation', async () => {
    const { repo, organization } = build();

    await repo.create({ name: 'Acme' } as any);

    expect(organization.create).toHaveBeenCalledWith({ data: { name: 'Acme' } });
  });

  it('findById includes memberships', async () => {
    const { repo, organization } = build();

    await repo.findById('org_1');

    expect(organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org_1' },
      include: { users: true },
    });
  });

  it('findByMemberId returns only that user membership rows', async () => {
    const { repo, orgMembership } = build();

    await repo.findByMemberId('u_1');

    expect(orgMembership.findMany).toHaveBeenCalledWith({
      where: { userId: 'u_1' },
      include: { organization: true },
    });
  });
});
