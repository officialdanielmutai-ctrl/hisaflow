import { PrismaService } from '../../infrastructure/prisma.service';
import { SchoolClassesService } from './school-classes.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build() {
  const create = jest.fn(async ({ data }: any) => ({ id: 'c_new', ...data }));
  const findMany = jest.fn(async (_args?: any) => [{ id: 'c1', organizationId: ORG, isActive: true }]);
  const findFirstOrThrow = jest.fn(async (args: any) => {
    if (args?.where?.organizationId !== ORG) throw new Error('No record found');
    return { id: args.where.id, organizationId: ORG };
  });
  const update = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const db: any = { schoolClass: { create, findMany, findFirstOrThrow, update } };
  const service = new SchoolClassesService({ db } as unknown as PrismaService);
  return { service, create, findMany, findFirstOrThrow, update };
}

describe('SchoolClassesService', () => {
  it('stamps the org on create', async () => {
    const { service, create } = build();

    await service.create({ name: 'Form 1' }, ORG);

    expect(create.mock.calls[0][0].data).toMatchObject({ organizationId: ORG, name: 'Form 1' });
  });

  it('lists only active classes for the org with a student count', async () => {
    const { service, findMany } = build();

    await service.findAll(ORG);

    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: ORG, isActive: true });
    expect(args.include).toEqual({ _count: { select: { students: true } } });
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('scopes findOne and rejects a foreign class', async () => {
    const { service } = build();

    await expect(service.findOne('c1', ORG)).resolves.toMatchObject({ id: 'c1' });
    await expect(service.findOne('c1', OTHER_ORG)).rejects.toThrow('No record found');
  });

  it('verifies ownership before update and deactivate', async () => {
    const { service, findFirstOrThrow, update } = build();

    await service.update('c1', { name: 'Form 1A' }, ORG);
    expect(findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 'c1', organizationId: ORG } });
    expect(update.mock.calls[0][0].data).toEqual({ name: 'Form 1A' });

    await service.deactivate('c1', ORG);
    expect(update.mock.calls[1][0].data).toEqual({ isActive: false });

    await expect(service.update('c1', { name: 'X' }, OTHER_ORG)).rejects.toThrow('No record found');
  });
});
