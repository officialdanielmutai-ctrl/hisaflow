import { PrismaService } from '../../infrastructure/prisma.service';
import { StudentsService } from './students.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    organizationId: ORG,
    name: 'Alice',
    admissionNumber: 'ADM1',
    classId: 'c1',
    isActive: true,
    ...overrides,
  };
}

function build() {
  const findMany = jest.fn(async (args: any) => {
    let rows = [student(), student({ id: 's2', organizationId: OTHER_ORG, name: 'Foreign' })];
    rows = rows.filter((s) => s.organizationId === args?.where?.organizationId);
    if (args?.where?.classId) rows = rows.filter((s) => s.classId === args.where.classId);
    return rows;
  });
  const findFirstOrThrow = jest.fn(async (args: any) => {
    const match = [student()].find(
      (s) => s.id === args?.where?.id && s.organizationId === args?.where?.organizationId,
    );
    if (!match) throw new Error('No record found');
    return match;
  });
  const create = jest.fn(async ({ data }: any) => ({ id: 's_new', ...data }));
  const update = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const db: any = { student: { findMany, findFirstOrThrow, create, update } };
  const service = new StudentsService({ db } as unknown as PrismaService);
  return { service, findMany, findFirstOrThrow, create, update };
}

describe('StudentsService — multi-tenant isolation', () => {
  it('stamps the organisation on create', async () => {
    const { service, create } = build();

    await service.create({ name: 'Alice' }, ORG);

    expect(create.mock.calls[0][0].data).toMatchObject({ organizationId: ORG, name: 'Alice' });
  });

  it('lists active students for the org and applies the class filter', async () => {
    const { service, findMany } = build();

    const rows = (await service.findAll(ORG, 'c1')) as Array<{ organizationId: string }>;

    expect(rows).toHaveLength(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: ORG,
      isActive: true,
      classId: 'c1',
    });
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('scopes findOne to the org and rejects a foreign student', async () => {
    const { service, findFirstOrThrow } = build();

    await expect(service.findOne('s1', ORG)).resolves.toMatchObject({ id: 's1' });
    expectEveryCallScopedToOrg(findFirstOrThrow, ORG);

    await expect(service.findOne('s1', OTHER_ORG)).rejects.toThrow('No record found');
  });

  it('verifies ownership before an update and before a deactivate', async () => {
    const { service, findFirstOrThrow, update } = build();

    await service.update('s1', { name: 'Alice B' }, ORG);
    expect(findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 's1', organizationId: ORG } });
    expect(update.mock.calls[0][0].data).toEqual({ name: 'Alice B' });

    await service.deactivate('s1', ORG);
    expect(update.mock.calls[1][0].data).toEqual({ isActive: false });

    await expect(service.deactivate('s1', OTHER_ORG)).rejects.toThrow('No record found');
  });

  it('searches only within the calling org', async () => {
    const { service, findMany } = build();

    await service.search(ORG, 'Ali');

    const where = findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG);
    expect(where.isActive).toBe(true);
    expect(where.OR).toHaveLength(2);
    expect(findMany.mock.calls[0][0].take).toBe(20);
  });
});
