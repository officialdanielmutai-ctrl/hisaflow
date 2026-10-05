import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { GuestsService } from './guests.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function guest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    organizationId: ORG,
    name: 'Alice',
    phone: '0700',
    idNumber: '1234',
    email: 'a@example.com',
    notes: null,
    ...overrides,
  };
}

function build() {
  const findMany = jest.fn(async (args: any) => [guest()].filter((g) => g.organizationId === args?.where?.organizationId));
  const findFirst = jest.fn(async (args: any) =>
    [guest()].find((g) => g.id === args?.where?.id && g.organizationId === args?.where?.organizationId) ?? null,
  );
  const create = jest.fn(async ({ data }: any) => ({ id: 'g_new', ...data }));
  const update = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const db: any = { guest: { findMany, findFirst, create, update } };
  const service = new GuestsService({ db } as unknown as PrismaService);
  return { service, findMany, findFirst, create, update };
}

describe('GuestsService — multi-tenant isolation', () => {
  it('lists only the calling org\u2019s guests', async () => {
    const { service, findMany } = build();

    const rows = (await service.findAll(ORG)) as Array<{ organizationId: string }>;

    expect(rows).toHaveLength(1);
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('throws NotFound for a guest in another org', async () => {
    const { service, findFirst } = build();

    await expect(service.findOne(ORG, 'g1')).resolves.toMatchObject({ id: 'g1' });
    expectEveryCallScopedToOrg(findFirst, ORG);

    await expect(service.findOne(OTHER_ORG, 'g1')).rejects.toThrow(NotFoundException);
  });

  it('stamps the organisation on create', async () => {
    const { service, create } = build();

    await service.create(ORG, { name: 'Bob' });

    expect(create.mock.calls[0][0].data).toMatchObject({ organizationId: ORG, name: 'Bob' });
  });

  it('will not update a foreign guest', async () => {
    const { service, update } = build();

    await expect(service.update(OTHER_ORG, 'g1', { name: 'Hacked' })).rejects.toThrow(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('updates an owned guest', async () => {
    const { service, update } = build();

    await service.update(ORG, 'g1', { name: 'Alice B' });

    expect(update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { name: 'Alice B' } });
  });
});
