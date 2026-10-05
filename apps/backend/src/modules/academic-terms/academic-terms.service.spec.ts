import { PrismaService } from '../../infrastructure/prisma.service';
import { AcademicTermsService } from './academic-terms.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build() {
  const academicTerm = {
    updateMany: jest.fn(async () => ({ count: 1 })),
    create: jest.fn(async ({ data }: any) => ({ id: 'term_new', ...data })),
    findMany: jest.fn(async (_args?: any) => [{ id: 'term_1', organizationId: ORG }]),
    findFirstOrThrow: jest.fn(async (args: any) => {
      if (args?.where?.organizationId !== ORG) throw new Error('No record found');
      return { id: args.where.id, organizationId: ORG };
    }),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const feeStructure = {
    create: jest.fn(async ({ data }: any) => ({ id: 'fs_new', ...data })),
    findUniqueOrThrow: jest.fn(async ({ where }: any) => ({
      id: where.id,
      term: { organizationId: ORG },
    })),
    delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
  };
  const tx = { academicTerm };
  const $transaction = jest.fn(async (cb: any) => cb(tx));
  const db: any = { academicTerm, feeStructure, $transaction };
  const service = new AcademicTermsService({ db } as unknown as PrismaService);
  return { service, academicTerm, feeStructure, $transaction };
}

describe('AcademicTermsService', () => {
  it('deactivates the previous active term and creates the new one atomically', async () => {
    const { service, academicTerm, $transaction } = build();

    await service.create(
      {
        name: 'Term 1',
        startDate: '2026-01-05',
        endDate: '2026-04-05',
        dueDate: '2026-01-20',
        isActive: true,
        feeStructures: [{ name: 'Tuition', amount: 3000 }] as any,
      },
      ORG,
    );

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(academicTerm.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, isActive: true },
      data: { isActive: false },
    });
    const data = academicTerm.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe(ORG);
    expect(data.startDate).toEqual(new Date('2026-01-05'));
    expect(data.feeStructures.create[0]).toMatchObject({ organizationId: ORG, name: 'Tuition' });
  });

  it('does not deactivate others when creating an inactive term', async () => {
    const { service, academicTerm } = build();

    await service.create({ name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-01' }, ORG);

    expect(academicTerm.updateMany).not.toHaveBeenCalled();
  });

  it('lists terms scoped to the org with a fee-structure count', async () => {
    const { service, academicTerm } = build();

    await service.findAll(ORG);

    expect(academicTerm.findMany.mock.calls[0][0]).toMatchObject({
      where: { organizationId: ORG },
      orderBy: { startDate: 'desc' },
    });
    expectEveryCallScopedToOrg(academicTerm.findMany, ORG);
  });

  it('refuses to read, update, or activate a foreign term', async () => {
    const { service } = build();

    await expect(service.findOne('term_1', OTHER_ORG)).rejects.toThrow('No record found');
    await expect(
      service.update('term_1', { name: 'X', startDate: '2026-01-01', endDate: '2026-02-01' }, OTHER_ORG),
    ).rejects.toThrow('No record found');
    await expect(service.activate('term_1', OTHER_ORG)).rejects.toThrow('No record found');
  });

  it('activates a term by deactivating the current one first', async () => {
    const { service, academicTerm } = build();

    await service.activate('term_1', ORG);

    expect(academicTerm.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, isActive: true },
      data: { isActive: false },
    });
    expect(academicTerm.update).toHaveBeenCalledWith({
      where: { id: 'term_1' },
      data: { isActive: true },
    });
  });

  it('adds a fee structure only after confirming the term belongs to the org', async () => {
    const { service, feeStructure } = build();

    await service.addFeeStructure('term_1', { name: 'Bus', amount: 500 } as any, ORG);

    expect(feeStructure.create.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      termId: 'term_1',
      name: 'Bus',
    });
  });

  it('refuses to remove a fee structure owned by another org', async () => {
    const { service, feeStructure } = build();
    feeStructure.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'fs1',
      term: { organizationId: OTHER_ORG },
    });

    await expect(service.removeFeeStructure('fs1', ORG)).rejects.toThrow('Unauthorized');
    expect(feeStructure.delete).not.toHaveBeenCalled();
  });

  it('removes an owned fee structure', async () => {
    const { service, feeStructure } = build();

    await service.removeFeeStructure('fs1', ORG);

    expect(feeStructure.delete).toHaveBeenCalledWith({ where: { id: 'fs1' } });
  });
});
