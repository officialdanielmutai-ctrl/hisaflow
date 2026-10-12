import { BadRequestException } from '@nestjs/common';
import { FeeInvoiceStatus } from '@prisma/client';
import { SchoolAssistantToolsService } from './school-assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'SCHOOL',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const STUDENT = {
  id: 'stu_1',
  name: 'Alice',
  admissionNumber: 'ADM1',
  classId: 'cls_1',
  class: { id: 'cls_1', name: 'Form 2' },
};

const TERM = {
  id: 'term_1',
  name: 'Term 1 2026',
  feeStructures: [{ id: 'fs1', classId: null, amount: 5000 }],
};

const INVOICE = {
  id: 'inv_1',
  status: FeeInvoiceStatus.ISSUED,
  totalExpected: 5000,
  adjustmentsTotal: 0,
  amountPaid: 1000,
  student: { id: 'stu_1', name: 'Alice' },
  term: { id: 'term_1', name: 'Term 1 2026' },
};

type MockFn = jest.Mock;

interface Harness {
  service: SchoolAssistantToolsService;
  db: {
    student: { findFirst: MockFn; findMany: MockFn };
    schoolClass: { findFirst: MockFn; findMany: MockFn };
    academicTerm: { findFirst: MockFn; findMany: MockFn };
    feeInvoice: { findFirst: MockFn; findMany: MockFn };
    inventoryItem: { findFirst: MockFn };
  };
  students: { create: MockFn; update: MockFn };
  classes: { create: MockFn; update: MockFn };
  fees: {
    getDefaulters: MockFn;
    getTermSummary: MockFn;
    generateForTerm: MockFn;
    recordPayment: MockFn;
    issueInvoice: MockFn;
    voidInvoice: MockFn;
  };
  transactions: { create: MockFn };
  byName: (name: string) => ToolDefinition;
}

function build(): Harness {
  const db = {
    student: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    schoolClass: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    academicTerm: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    feeInvoice: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    inventoryItem: { findFirst: jest.fn(async () => null as unknown) },
  };
  const students = {
    create: jest.fn(async () => ({ id: 'stu_new' })),
    update: jest.fn(async () => ({ id: 'stu_1' })),
  };
  const classes = {
    create: jest.fn(async () => ({ id: 'cls_new' })),
    update: jest.fn(async () => ({ id: 'cls_1' })),
  };
  const fees = {
    getDefaulters: jest.fn(async () => [] as unknown[]),
    getTermSummary: jest.fn(async () => ({ totalExpected: 5000 })),
    generateForTerm: jest.fn(async () => ({ created: 2, skipped: 1 })),
    recordPayment: jest.fn(async () => ({ id: 'pay_1' })),
    issueInvoice: jest.fn(async () => ({ id: 'inv_1' })),
    voidInvoice: jest.fn(async () => ({ id: 'inv_1' })),
  };
  const transactions = { create: jest.fn(async () => ({ id: 'tx_1' })) };

  const service = new SchoolAssistantToolsService(
    { db } as never,
    students as never,
    classes as never,
    fees as never,
    transactions as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return { service, db, students, classes, fees, transactions, byName };
}

describe('SchoolAssistantToolsService vertical gating', () => {
  it('gates every school tool to the SCHOOL vertical', () => {
    const { service } = build();
    const tools = service.all();
    expect(tools).toHaveLength(15);
    for (const tool of tools) {
      expect(tool.verticals).toEqual(['SCHOOL']);
    }
  });

  it('restricts structural and financial-invoice tools to owners and managers', () => {
    const { byName } = build();
    for (const name of [
      'create_class',
      'update_class',
      'generate_fee_invoices',
      'issue_fee_invoice',
      'void_fee_invoice',
    ]) {
      expect(byName(name).roles).toEqual([AppRole.OWNER, AppRole.MANAGER]);
    }
    expect(byName('void_fee_invoice').riskLevel).toBe('high');
  });
});

describe('SchoolAssistantToolsService.search_students', () => {
  it('scopes to the organization and searches name or admission number', async () => {
    const h = build();
    h.db.student.findMany.mockResolvedValue([STUDENT]);

    const result = await h.byName('search_students').execute?.(
      { query: 'Alice', limit: 5 },
      CTX,
    );

    expect(h.db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
        take: 5,
      }),
    );
    expect(result).toEqual([STUDENT]);
  });
});

describe('SchoolAssistantToolsService.list_classes / list_academic_terms', () => {
  it('lists active classes scoped to the organization', async () => {
    const h = build();
    await h.byName('list_classes').execute?.({}, CTX);
    expect(h.db.schoolClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', isActive: true },
      }),
    );
  });

  it('lists terms scoped to the organization', async () => {
    const h = build();
    await h.byName('list_academic_terms').execute?.({}, CTX);
    expect(h.db.academicTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org_1' } }),
    );
  });
});

describe('SchoolAssistantToolsService.list_fee_defaulters', () => {
  it('keeps only rows with a positive balance and verifies the term', async () => {
    const h = build();
    h.db.academicTerm.findFirst.mockResolvedValue(TERM);
    h.fees.getDefaulters.mockResolvedValue([
      { studentName: 'Alice', balance: 4000 },
      { studentName: 'Bob', balance: 0 },
    ]);

    const result = (await h
      .byName('list_fee_defaulters')
      .execute?.({ termId: 'term_1' }, CTX)) as unknown[];

    expect(h.db.academicTerm.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'term_1', organizationId: 'org_1' },
      }),
    );
    expect(result).toEqual([{ studentName: 'Alice', balance: 4000 }]);
  });
});

describe('SchoolAssistantToolsService.get_fee_summary', () => {
  it('verifies the term then delegates to the fees service', async () => {
    const h = build();
    h.db.academicTerm.findFirst.mockResolvedValue(TERM);
    const result = await h
      .byName('get_fee_summary')
      .execute?.({ termId: 'term_1' }, CTX);
    expect(h.fees.getTermSummary).toHaveBeenCalledWith('term_1', 'org_1');
    expect(result).toEqual({ totalExpected: 5000 });
  });
});

describe('SchoolAssistantToolsService.list_fee_invoices', () => {
  it('requires a term or student id', async () => {
    const h = build();
    await expect(
      h.byName('list_fee_invoices').execute?.({}, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns invoices with a computed balance', async () => {
    const h = build();
    h.db.student.findFirst.mockResolvedValue(STUDENT);
    h.db.feeInvoice.findMany.mockResolvedValue([
      {
        id: 'inv_1',
        status: 'ISSUED',
        totalExpected: 5000,
        adjustmentsTotal: 0,
        amountPaid: 1000,
        student: { id: 'stu_1', name: 'Alice', class: { name: 'Form 2' } },
        term: { id: 'term_1', name: 'Term 1 2026' },
      },
    ]);

    const result = (await h
      .byName('list_fee_invoices')
      .execute?.({ studentId: 'stu_1' }, CTX)) as Array<{ balance: number }>;

    expect(result[0]).toMatchObject({
      student: 'Alice',
      className: 'Form 2',
      balance: 4000,
    });
  });
});

describe('SchoolAssistantToolsService.create_student', () => {
  it('validates the class, drafts and commits', async () => {
    const h = build();
    h.db.schoolClass.findFirst.mockResolvedValue({ id: 'cls_1', name: 'Form 2' });
    const tool = h.byName('create_student');

    const draft = await tool.buildProposal?.(
      { name: '  Alice ', classId: 'cls_1', guardianEmail: 'mum@example.com' },
      CTX,
    );
    expect(draft?.args).toMatchObject({
      name: 'Alice',
      classId: 'cls_1',
      guardianEmail: 'mum@example.com',
    });
    expect(draft?.summary).toContain('Form 2');
    expect(h.students.create).not.toHaveBeenCalled();

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(h.students.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice', classId: 'cls_1' }),
      'org_1',
    );
  });

  it('refuses a class outside the organization', async () => {
    const h = build();
    h.db.schoolClass.findFirst.mockResolvedValue(null);
    await expect(
      h.byName('create_student').buildProposal?.(
        { name: 'Alice', classId: 'other' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SchoolAssistantToolsService.update_student', () => {
  it('rejects when no changes are supplied', async () => {
    const h = build();
    h.db.student.findFirst.mockResolvedValue(STUDENT);
    await expect(
      h.byName('update_student').buildProposal?.({ studentId: 'stu_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('commits a partial update', async () => {
    const h = build();
    h.db.student.findFirst.mockResolvedValue(STUDENT);
    const draft = await h
      .byName('update_student')
      .buildProposal?.({ studentId: 'stu_1', guardianPhone: '0712' }, CTX);
    expect(draft?.args).toEqual({
      studentId: 'stu_1',
      updates: { guardianPhone: '0712' },
    });

    await h.byName('update_student').commit?.(draft?.args ?? {}, CTX);
    expect(h.students.update).toHaveBeenCalledWith(
      'stu_1',
      expect.objectContaining({ guardianPhone: '0712' }),
      'org_1',
    );
  });
});

describe('SchoolAssistantToolsService class tools', () => {
  it('creates a class through the service', async () => {
    const h = build();
    const draft = await h
      .byName('create_class')
      .buildProposal?.({ name: 'Form 3', stream: 'B' }, CTX);
    await h.byName('create_class').commit?.(draft?.args ?? {}, CTX);
    expect(h.classes.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Form 3', stream: 'B' }),
      'org_1',
    );
  });

  it('rejects an empty class update and otherwise commits a partial', async () => {
    const h = build();
    h.db.schoolClass.findFirst.mockResolvedValue({
      id: 'cls_1',
      name: 'Form 2',
      stream: 'A',
    });
    await expect(
      h.byName('update_class').buildProposal?.({ classId: 'cls_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);

    const draft = await h
      .byName('update_class')
      .buildProposal?.({ classId: 'cls_1', stream: 'B' }, CTX);
    await h.byName('update_class').commit?.(draft?.args ?? {}, CTX);
    expect(h.classes.update).toHaveBeenCalledWith(
      'cls_1',
      expect.objectContaining({ stream: 'B' }),
      'org_1',
    );
  });
});

describe('SchoolAssistantToolsService.generate_fee_invoices', () => {
  it('projects how many invoices will be created and commits', async () => {
    const h = build();
    h.db.academicTerm.findFirst.mockResolvedValue(TERM);
    h.db.student.findMany.mockResolvedValue([
      { id: 'stu_1', classId: 'cls_1' },
      { id: 'stu_2', classId: 'cls_1' },
    ]);
    h.db.feeInvoice.findMany.mockResolvedValue([{ studentId: 'stu_1' }]);

    const draft = await h
      .byName('generate_fee_invoices')
      .buildProposal?.({ termId: 'term_1' }, CTX);

    expect(draft?.diff).toMatchObject({
      after: { activeStudents: 2, alreadyInvoiced: 1, toCreate: 1 },
    });

    await h
      .byName('generate_fee_invoices')
      .commit?.({ termId: 'term_1' }, CTX);
    expect(h.fees.generateForTerm).toHaveBeenCalledWith('term_1', 'org_1');
  });
});

describe('SchoolAssistantToolsService.record_fee_payment', () => {
  it('refuses a draft invoice', async () => {
    const h = build();
    h.db.feeInvoice.findFirst.mockResolvedValue({
      ...INVOICE,
      status: FeeInvoiceStatus.DRAFT,
    });
    await expect(
      h.byName('record_fee_payment').buildProposal?.(
        { invoiceId: 'inv_1', amount: 1000, method: 'MPESA' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes the balance change and commits the payment', async () => {
    const h = build();
    h.db.feeInvoice.findFirst.mockResolvedValue(INVOICE);

    const draft = await h.byName('record_fee_payment').buildProposal?.(
      { invoiceId: 'inv_1', amount: 2000, method: 'mpesa' },
      CTX,
    );
    expect(draft?.diff).toEqual({ balance: { before: 4000, after: 2000 } });
    expect(draft?.args).toMatchObject({ method: 'MPESA' });

    await h.byName('record_fee_payment').commit?.(draft?.args ?? {}, CTX);
    expect(h.fees.recordPayment).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ amount: 2000, method: 'MPESA' }),
      'org_1',
    );
  });

  it('rejects an unknown payment method', async () => {
    const h = build();
    h.db.feeInvoice.findFirst.mockResolvedValue(INVOICE);
    await expect(
      h.byName('record_fee_payment').buildProposal?.(
        { invoiceId: 'inv_1', amount: 1000, method: 'bitcoin' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SchoolAssistantToolsService.issue / void fee invoice', () => {
  it('refuses to issue a non-draft invoice', async () => {
    const h = build();
    h.db.feeInvoice.findFirst.mockResolvedValue(INVOICE);
    await expect(
      h.byName('issue_fee_invoice').buildProposal?.({ invoiceId: 'inv_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('issues a draft and voids an issued invoice', async () => {
    const h = build();
    h.db.feeInvoice.findFirst.mockResolvedValue({
      ...INVOICE,
      status: FeeInvoiceStatus.DRAFT,
    });
    const issueDraft = await h
      .byName('issue_fee_invoice')
      .buildProposal?.({ invoiceId: 'inv_1' }, CTX);
    expect(issueDraft?.diff).toEqual({
      status: { before: 'DRAFT', after: 'ISSUED' },
    });
    await h.byName('issue_fee_invoice').commit?.({ invoiceId: 'inv_1' }, CTX);
    expect(h.fees.issueInvoice).toHaveBeenCalledWith('inv_1', 'org_1');

    h.db.feeInvoice.findFirst.mockResolvedValue(INVOICE);
    const voidDraft = await h
      .byName('void_fee_invoice')
      .buildProposal?.({ invoiceId: 'inv_1' }, CTX);
    expect(voidDraft?.diff).toEqual({
      status: { before: 'ISSUED', after: 'VOIDED' },
    });
    await h.byName('void_fee_invoice').commit?.({ invoiceId: 'inv_1' }, CTX);
    expect(h.fees.voidInvoice).toHaveBeenCalledWith('inv_1', 'org_1');
  });
});

describe('SchoolAssistantToolsService.record_supply_issue', () => {
  it('checks stock and commits a SALE transaction', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({
      id: 'item_1',
      name: 'Exercise book',
      unit: 'books',
      quantity: 50,
    });

    const draft = await h.byName('record_supply_issue').buildProposal?.(
      { itemId: 'item_1', quantity: 20, note: 'Form 2' },
      CTX,
    );
    expect(draft?.diff).toEqual({
      item: 'Exercise book',
      quantity: { before: 50, after: 30 },
    });

    await h.byName('record_supply_issue').commit?.(draft?.args ?? {}, CTX);
    expect(h.transactions.create).toHaveBeenCalledWith(
      { itemId: 'item_1', type: 'SALE', quantity: 20, note: 'Form 2' },
      'org_1',
      expect.objectContaining({ actorId: 'user_1', actorRole: AppRole.OWNER }),
    );
  });

  it('refuses to issue more than is in stock', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({
      id: 'item_1',
      name: 'Exercise book',
      unit: 'books',
      quantity: 5,
    });
    await expect(
      h.byName('record_supply_issue').buildProposal?.(
        { itemId: 'item_1', quantity: 20 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
