import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { SchoolFeesService } from './school-fees.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

interface FeeInvoiceSeed {
  id?: string;
  status?: string;
  totalExpected?: number | string;
  adjustmentsTotal?: number | string;
  amountPaid?: number | string;
  studentId?: string;
  studentName?: string;
  className?: string | null;
}

function invoice(seed: FeeInvoiceSeed = {}) {
  return {
    id: seed.id ?? 'fi_1',
    organizationId: ORG,
    termId: 'term_1',
    studentId: seed.studentId ?? 'stu_1',
    totalExpected: decimal(seed.totalExpected ?? 1000),
    adjustmentsTotal: decimal(seed.adjustmentsTotal ?? 0),
    amountPaid: decimal(seed.amountPaid ?? 0),
    status: seed.status ?? 'ISSUED',
    student: {
      id: seed.studentId ?? 'stu_1',
      name: seed.studentName ?? 'Alice',
      class: seed.className === null ? null : { name: seed.className ?? 'Form 1' },
    },
  };
}

function build(opts: { invoices?: ReturnType<typeof invoice>[] } = {}) {
  const feeInvoice = {
    findMany: jest.fn(async (args: any): Promise<any[]> =>
      (opts.invoices ?? []).filter((inv) => inv.organizationId === args?.where?.organizationId),
    ),
    findFirstOrThrow: jest.fn(async (args: any) => {
      const match = (opts.invoices ?? []).find(
        (inv) => inv.id === args?.where?.id && inv.organizationId === args?.where?.organizationId,
      );
      if (!match) throw new Error('No record found');
      return match;
    }),
    create: jest.fn(async ({ data }: any) => ({ id: 'fi_new', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const feePayment = { create: jest.fn(async ({ data }: any) => ({ id: 'fp_1', ...data })) };
  const feeLineItem = { create: jest.fn(async ({ data }: any) => ({ id: 'fli_1', ...data })) };
  const academicTerm = {
    findFirstOrThrow: jest.fn(async (args: any) => {
      if (args?.where?.organizationId !== ORG) throw new Error('No record found');
      return {
        id: 'term_1',
        organizationId: ORG,
        feeStructures: [
          { id: 'fs_all', name: 'Tuition', amount: decimal(3000), classId: null },
          { id: 'fs_f1', name: 'Boarding', amount: decimal(2000), classId: 'class_f1' },
        ],
      };
    }),
  };
  const student = {
    findMany: jest.fn(async () => [
      { id: 'stu_1', name: 'Alice', classId: 'class_f1', isActive: true },
      { id: 'stu_2', name: 'Bob', classId: 'class_f1', isActive: true },
      { id: 'stu_3', name: 'Carol', classId: 'class_none', isActive: true },
    ]),
  };

  const tx = { feeInvoice, feePayment, feeLineItem };
  const $transaction = jest.fn(async (arg: any) =>
    typeof arg === 'function' ? arg(tx) : Promise.all(arg),
  );

  const db: any = { feeInvoice, feePayment, feeLineItem, academicTerm, student, $transaction };
  const service = new SchoolFeesService({ db } as unknown as PrismaService);
  return { service, feeInvoice, feePayment, feeLineItem, academicTerm, student, $transaction };
}

describe('SchoolFeesService — billing generation', () => {
  it('generates invoices for active students and skips ones already invoiced', async () => {
    const { service, feeInvoice, academicTerm } = build();
    // stu_2 already has an invoice for the term.
    feeInvoice.findMany.mockResolvedValueOnce([
      { organizationId: ORG, studentId: 'stu_2' },
    ]);

    const result = await service.generateForTerm('term_1', ORG);

    // stu_1 gets 3000 + 2000; stu_2 skipped (existing); stu_3 gets the
    // org-wide 3000 structure (classId null).
    expect(result).toEqual({ created: 2, skipped: 1 });
    const created = feeInvoice.create.mock.calls[0][0].data;
    expect(created.organizationId).toBe(ORG);
    expect(Number(created.totalExpected)).toBe(5000);
    expect(created.lineItems.create).toHaveLength(2);
    expectEveryCallScopedToOrg(academicTerm.findFirstOrThrow, ORG);
  });

  it('rejects a term that does not belong to the calling org', async () => {
    const { service } = build();

    await expect(service.generateForTerm('term_1', OTHER_ORG)).rejects.toThrow('No record found');
  });
});

describe('SchoolFeesService — payment math', () => {
  it('rejects a payment on a DRAFT invoice', async () => {
    const draft = invoice({ status: 'DRAFT' });
    const { service, feePayment } = build({ invoices: [draft] });

    await expect(
      service.recordPayment('fi_1', { amount: 100, method: 'CASH' }, ORG),
    ).rejects.toThrow(BadRequestException);
    expect(feePayment.create).not.toHaveBeenCalled();
  });

  it('rejects a payment on a VOIDED invoice', async () => {
    const voided = invoice({ status: 'VOIDED' });
    const { service } = build({ invoices: [voided] });

    await expect(
      service.recordPayment('fi_1', { amount: 100, method: 'CASH' }, ORG),
    ).rejects.toThrow('Cannot pay a DRAFT or VOIDED invoice');
  });

  it('records a partial payment and marks the invoice PARTIAL', async () => {
    const { service, feePayment, feeInvoice, $transaction } = build({
      invoices: [invoice({ amountPaid: 0 })],
    });

    await service.recordPayment('fi_1', { amount: 400, method: 'MPESA' }, ORG);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(feePayment.create.mock.calls[0][0].data).toMatchObject({
      invoiceId: 'fi_1',
      amount: 400,
      method: 'MPESA',
    });
    expect(feeInvoice.update.mock.calls[0][0].data).toMatchObject({
      amountPaid: 400,
      status: 'PARTIAL',
    });
  });

  it('marks the invoice PAID once the balance is cleared', async () => {
    const { service, feeInvoice } = build({
      invoices: [invoice({ amountPaid: 400 })],
    });

    await service.recordPayment('fi_1', { amount: 600, method: 'BANK' }, ORG);

    expect(feeInvoice.update.mock.calls[0][0].data).toMatchObject({
      amountPaid: 1000,
      status: 'PAID',
    });
  });

  it('refuses to touch an invoice owned by another org', async () => {
    const { service } = build({ invoices: [invoice()] });

    await expect(
      service.recordPayment('fi_1', { amount: 100, method: 'CASH' }, OTHER_ORG),
    ).rejects.toThrow('No record found');
  });
});

describe('SchoolFeesService — adjustments and statuses', () => {
  it('a waiver increases adjustmentsTotal but not totalExpected', async () => {
    const { service, feeInvoice } = build({ invoices: [invoice()] });

    await service.addAdjustment('fi_1', 'Bursary', 200, true, ORG);

    expect(feeInvoice.update.mock.calls[0][0].data).toMatchObject({
      adjustmentsTotal: 200,
      totalExpected: 1000,
    });
  });

  it('a non-waiver adjustment increases totalExpected', async () => {
    const { service, feeInvoice } = build({ invoices: [invoice()] });

    await service.addAdjustment('fi_1', 'Transport', 300, false, ORG);

    expect(feeInvoice.update.mock.calls[0][0].data).toMatchObject({
      totalExpected: 1300,
      adjustmentsTotal: 0,
    });
  });

  it('issues only DRAFT invoices', async () => {
    const { service } = build({ invoices: [invoice({ status: 'ISSUED' })] });

    await expect(service.issueInvoice('fi_1', ORG)).rejects.toThrow(
      'Can only issue DRAFT invoices',
    );
  });

  it('issues a draft and computes ISSUED when money is still owed', async () => {
    const { service, feeInvoice } = build({ invoices: [invoice({ status: 'DRAFT' })] });

    await service.issueInvoice('fi_1', ORG);

    expect(feeInvoice.update.mock.calls[0][0].data).toEqual({ status: 'ISSUED' });
  });

  it('voids an invoice scoped to the org', async () => {
    const { service, feeInvoice } = build({ invoices: [invoice()] });

    await service.voidInvoice('fi_1', ORG);

    expect(feeInvoice.update.mock.calls[0][0].data).toEqual({ status: 'VOIDED' });
  });
});

describe('SchoolFeesService — reporting', () => {
  it('summarises a term and computes the collection rate', async () => {
    const { service } = build({
      invoices: [
        invoice({ id: 'fi_1', totalExpected: 1000, amountPaid: 400, studentName: 'Alice', className: 'Form 1' }),
        invoice({ id: 'fi_2', totalExpected: 1000, amountPaid: 1000, studentName: 'Bob', className: 'Form 1' }),
        invoice({ id: 'fi_3', totalExpected: 500, amountPaid: 0, studentName: 'Carol', className: 'Form 2' }),
      ],
    });

    const summary = await service.getTermSummary('term_1', ORG);

    expect(summary.totalExpected).toBe(2500);
    expect(summary.totalCollected).toBe(1400);
    expect(summary.outstanding).toBe(1100);
    expect(summary.collectionRate).toBeCloseTo(56, 0);
    expect(summary.byClass).toHaveLength(2);
  });

  it('lists defaulters with a correctly computed balance', async () => {
    const { service } = build({
      invoices: [
        invoice({ id: 'fi_1', totalExpected: 1000, adjustmentsTotal: 100, amountPaid: 200, status: 'PARTIAL' }),
      ],
    });

    const defaulters = await service.getDefaulters('term_1', ORG);

    expect(defaulters).toEqual([
      expect.objectContaining({
        studentId: 'stu_1',
        amountPaid: 200,
        totalExpected: 900,
        balance: 700,
        status: 'PARTIAL',
      }),
    ]);
  });

  it('scopes findInvoice to the calling org', async () => {
    const { service, feeInvoice } = build({ invoices: [invoice()] });

    await service.findInvoice('fi_1', ORG);
    expectEveryCallScopedToOrg(feeInvoice.findFirstOrThrow, ORG);

    await expect(service.findInvoice('fi_1', OTHER_ORG)).rejects.toThrow('No record found');
  });
});
