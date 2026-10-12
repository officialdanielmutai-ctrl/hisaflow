import { BadRequestException, Injectable } from '@nestjs/common';
import { FeeInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { StudentsService } from '../../students/students.service';
import type { CreateStudentDto } from '../../students/dto/create-student.dto';
import { SchoolClassesService } from '../../school-classes/school-classes.service';
import type { CreateSchoolClassDto } from '../../school-classes/dto/create-school-class.dto';
import { SchoolFeesService } from '../../school-fees/school-fees.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asEnum,
  asLimit,
  asOptionalDate,
  asOptionalEmail,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

const PAYMENT_METHODS = ['MPESA', 'BANK', 'CASH'] as const;

const SCHOOL = ['SCHOOL'];
const STAFF_ROLES = [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF];
const MANAGER_ROLES = [AppRole.OWNER, AppRole.MANAGER];

interface FeeInvoiceTotals {
  totalExpected: unknown;
  adjustmentsTotal: unknown;
  amountPaid: unknown;
}

/** Outstanding balance on a fee invoice (expected − waived adjustments − paid). */
function feeBalance(invoice: FeeInvoiceTotals): number {
  const balance =
    Number(invoice.totalExpected) -
    Number(invoice.adjustmentsTotal) -
    Number(invoice.amountPaid);
  return Math.round(balance * 100) / 100;
}

/**
 * SCHOOL tool set (overhaul Duty 2, Phase E — remaining verticals).
 *
 * Same contract as DUKA/ISP/guest house: `read` tools run immediately, `write`
 * tools only build a proposal, and the executor commits through the same
 * students / classes / terms / fees / transactions services the manual UI uses.
 */
@Injectable()
export class SchoolAssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly classes: SchoolClassesService,
    private readonly fees: SchoolFeesService,
    private readonly transactions: TransactionsService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // reads
      this.searchStudents(),
      this.listClasses(),
      this.listAcademicTerms(),
      this.listFeeDefaulters(),
      this.getFeeSummary(),
      this.listFeeInvoices(),
      // writes
      this.createStudent(),
      this.updateStudent(),
      this.createClass(),
      this.updateClass(),
      this.generateFeeInvoices(),
      this.recordFeePayment(),
      this.issueFeeInvoice(),
      this.voidFeeInvoice(),
      this.recordSupplyIssue(),
    ];
  }

  // ── scoped lookups ──────────────────────────────────────────────────────
  private async findStudent(organizationId: string, id: string) {
    const student = await this.prisma.db.student.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        admissionNumber: true,
        classId: true,
        class: { select: { id: true, name: true } },
      },
    });
    if (!student) {
      throw new BadRequestException(
        'No matching student in this organization.',
      );
    }
    return student;
  }

  private async findClass(organizationId: string, id: string) {
    const schoolClass = await this.prisma.db.schoolClass.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, stream: true, notes: true },
    });
    if (!schoolClass) {
      throw new BadRequestException('No matching class in this organization.');
    }
    return schoolClass;
  }

  private async findTerm(organizationId: string, id: string) {
    const term = await this.prisma.db.academicTerm.findFirst({
      where: { id, organizationId },
      include: { feeStructures: true },
    });
    if (!term) {
      throw new BadRequestException('No matching term in this organization.');
    }
    return term;
  }

  private async findFeeInvoice(organizationId: string, id: string) {
    const invoice = await this.prisma.db.feeInvoice.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        totalExpected: true,
        adjustmentsTotal: true,
        amountPaid: true,
        student: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
    });
    if (!invoice) {
      throw new BadRequestException(
        'No matching fee invoice in this organization.',
      );
    }
    return invoice;
  }

  // ── read: students ──────────────────────────────────────────────────────
  private searchStudents(): ToolDefinition {
    return {
      name: 'search_students',
      description:
        'Search students by name or admission number. Read-only. Use this to resolve a student name to its ID.',
      kind: 'read',
      riskLevel: 'low',
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Student name or admission number.' },
          limit: { type: 'number' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const query = asString(args.query, 'query', 100);
        const limit = asLimit(args.limit, 10);
        return this.prisma.db.student.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { admissionNumber: { contains: query, mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
          take: limit,
          select: {
            id: true,
            name: true,
            admissionNumber: true,
            class: { select: { id: true, name: true } },
            guardianName: true,
            guardianPhone: true,
          },
        });
      },
    };
  }

  // ── read: classes ───────────────────────────────────────────────────────
  private listClasses(): ToolDefinition {
    return {
      name: 'list_classes',
      description:
        'List the school\u2019s active classes with their student counts. Read-only. Use this to resolve a class name to its ID.',
      kind: 'read',
      riskLevel: 'low',
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async (_raw, ctx) =>
        this.prisma.db.schoolClass.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            stream: true,
            _count: { select: { students: true } },
          },
        }),
    };
  }

  // ── read: academic terms ────────────────────────────────────────────────
  private listAcademicTerms(): ToolDefinition {
    return {
      name: 'list_academic_terms',
      description:
        'List academic terms with their dates and fee-structure counts. Read-only. Use this to resolve a term name to its ID before generating invoices or viewing fees.',
      kind: 'read',
      riskLevel: 'low',
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async (_raw, ctx) =>
        this.prisma.db.academicTerm.findMany({
          where: { organizationId: ctx.organizationId },
          orderBy: { startDate: 'desc' },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            dueDate: true,
            isActive: true,
            _count: { select: { feeStructures: true, feeInvoices: true } },
          },
        }),
    };
  }

  // ── read: fee defaulters ────────────────────────────────────────────────
  private listFeeDefaulters(): ToolDefinition {
    return {
      name: 'list_fee_defaulters',
      description:
        'List students with an outstanding fee balance for a term. Read-only. Use list_academic_terms to find the term ID.',
      kind: 'read',
      riskLevel: 'low',
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          termId: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['termId'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const termId = asString(args.termId, 'termId', 100);
        const limit = asLimit(args.limit, 20);
        await this.findTerm(ctx.organizationId, termId);
        const rows = await this.fees.getDefaulters(termId, ctx.organizationId);
        return rows.filter((row) => row.balance > 0).slice(0, limit);
      },
    };
  }

  // ── read: fee summary ───────────────────────────────────────────────────
  private getFeeSummary(): ToolDefinition {
    return {
      name: 'get_fee_summary',
      description:
        'Show expected, collected and outstanding fees for a term, broken down by class. Read-only.',
      kind: 'read',
      riskLevel: 'low',
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: { termId: { type: 'string' } },
        required: ['termId'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const termId = asString(args.termId, 'termId', 100);
        await this.findTerm(ctx.organizationId, termId);
        return this.fees.getTermSummary(termId, ctx.organizationId);
      },
    };
  }

  // ── read: fee invoices ──────────────────────────────────────────────────
  private listFeeInvoices(): ToolDefinition {
    return {
      name: 'list_fee_invoices',
      description:
        'List fee invoices for a term or one student, with balances. Read-only. Use this to resolve an invoice ID before recording a payment.',
      kind: 'read',
      riskLevel: 'low',
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          termId: { type: 'string' },
          studentId: { type: 'string' },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const termId = asOptionalString(args.termId, 'termId', 100);
        const studentId = asOptionalString(args.studentId, 'studentId', 100);
        if (!termId && !studentId) {
          throw new BadRequestException(
            'Provide either "termId" or "studentId".',
          );
        }
        const limit = asLimit(args.limit, 20);
        if (termId) await this.findTerm(ctx.organizationId, termId);
        if (studentId) await this.findStudent(ctx.organizationId, studentId);
        const invoices = await this.prisma.db.feeInvoice.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(termId ? { termId } : {}),
            ...(studentId ? { studentId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            status: true,
            totalExpected: true,
            adjustmentsTotal: true,
            amountPaid: true,
            student: {
              select: {
                id: true,
                name: true,
                class: { select: { name: true } },
              },
            },
            term: { select: { id: true, name: true } },
          },
        });
        return invoices.map((invoice) => ({
          id: invoice.id,
          status: invoice.status,
          student: invoice.student.name,
          className: invoice.student.class?.name ?? null,
          term: invoice.term.name,
          totalExpected: Number(invoice.totalExpected),
          amountPaid: Number(invoice.amountPaid),
          balance: feeBalance(invoice),
        }));
      },
    };
  }

  // ── write: create a student ─────────────────────────────────────────────
  private createStudent(): ToolDefinition {
    return {
      name: 'create_student',
      description:
        'Enrol a new student, optionally into a class. Requires approval. Use list_classes for the class ID.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          classId: { type: 'string' },
          admissionNumber: { type: 'string' },
          dateOfBirth: { type: 'string', description: 'ISO date.' },
          guardianName: { type: 'string' },
          guardianPhone: { type: 'string' },
          guardianEmail: { type: 'string' },
          guardianRelation: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const normalised = await this.buildStudentFields(args, ctx.organizationId);
        const className = normalised.classId
          ? (await this.findClass(ctx.organizationId, normalised.classId)).name
          : null;
        return {
          args: normalised,
          summary: `Enrol ${normalised.name}${
            className ? ` in ${className}` : ''
          }`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.students.create(await this.buildStudentFields(args, ctx.organizationId), ctx.organizationId);
      },
    };
  }

  private async buildStudentFields(
    args: Record<string, unknown>,
    organizationId: string,
  ) {
    const classId = asOptionalString(args.classId, 'classId', 100);
    if (classId) await this.findClass(organizationId, classId);
    return {
      name: asString(args.name, 'name', 200),
      classId,
      admissionNumber: asOptionalString(args.admissionNumber, 'admissionNumber', 60),
      dateOfBirth: asOptionalDate(args.dateOfBirth, 'dateOfBirth'),
      guardianName: asOptionalString(args.guardianName, 'guardianName', 200),
      guardianPhone: asOptionalString(args.guardianPhone, 'guardianPhone', 40),
      guardianEmail: asOptionalEmail(args.guardianEmail, 'guardianEmail'),
      guardianRelation: asOptionalString(
        args.guardianRelation,
        'guardianRelation',
        60,
      ),
      notes: asOptionalString(args.notes, 'notes', 500),
    };
  }

  // ── write: update a student ─────────────────────────────────────────────
  private updateStudent(): ToolDefinition {
    return {
      name: 'update_student',
      description:
        'Change a student\u2019s name, class, admission number or guardian details. Requires approval. Use search_students for the student ID.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string' },
          name: { type: 'string' },
          classId: { type: 'string' },
          admissionNumber: { type: 'string' },
          dateOfBirth: { type: 'string', description: 'ISO date.' },
          guardianName: { type: 'string' },
          guardianPhone: { type: 'string' },
          guardianEmail: { type: 'string' },
          guardianRelation: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['studentId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const studentId = asString(args.studentId, 'studentId', 100);
        const student = await this.findStudent(ctx.organizationId, studentId);
        const updates = await this.buildStudentUpdates(args, ctx.organizationId);
        if (Object.keys(updates).length === 0) {
          throw new BadRequestException('No changes were supplied.');
        }
        return {
          args: { studentId: student.id, updates },
          summary: `Update ${student.name} (${Object.keys(updates).join(', ')})`,
          diff: { student: student.name, before: null, after: updates },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const updates = asRecord(args.updates);
        return this.students.update(
          asString(args.studentId, 'studentId', 100),
          (await this.buildStudentUpdates(
            updates,
            ctx.organizationId,
            false,
          )) as Partial<CreateStudentDto> as CreateStudentDto,
          ctx.organizationId,
        );
      },
    };
  }

  private async buildStudentUpdates(
    args: Record<string, unknown>,
    organizationId: string,
    verifyClass = true,
  ): Promise<Record<string, unknown>> {
    const updates: Record<string, unknown> = {};
    const name = asOptionalString(args.name, 'name', 200);
    const classId = asOptionalString(args.classId, 'classId', 100);
    const admissionNumber = asOptionalString(
      args.admissionNumber,
      'admissionNumber',
      60,
    );
    const dateOfBirth = asOptionalDate(args.dateOfBirth, 'dateOfBirth');
    const guardianName = asOptionalString(args.guardianName, 'guardianName', 200);
    const guardianPhone = asOptionalString(
      args.guardianPhone,
      'guardianPhone',
      40,
    );
    const guardianEmail = asOptionalEmail(args.guardianEmail, 'guardianEmail');
    const guardianRelation = asOptionalString(
      args.guardianRelation,
      'guardianRelation',
      60,
    );
    const notes = asOptionalString(args.notes, 'notes', 500);
    if (name !== undefined) updates.name = name;
    if (classId !== undefined) {
      if (verifyClass) await this.findClass(organizationId, classId);
      updates.classId = classId;
    }
    if (admissionNumber !== undefined) updates.admissionNumber = admissionNumber;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    if (guardianName !== undefined) updates.guardianName = guardianName;
    if (guardianPhone !== undefined) updates.guardianPhone = guardianPhone;
    if (guardianEmail !== undefined) updates.guardianEmail = guardianEmail;
    if (guardianRelation !== undefined)
      updates.guardianRelation = guardianRelation;
    if (notes !== undefined) updates.notes = notes;
    return updates;
  }

  // ── write: create a class ───────────────────────────────────────────────
  private createClass(): ToolDefinition {
    return {
      name: 'create_class',
      description: 'Create a school class or stream. Requires approval.',
      kind: 'write',
      riskLevel: 'low',
      roles: MANAGER_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          stream: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const args = asRecord(raw);
        const normalised = {
          name: asString(args.name, 'name', 100),
          stream: asOptionalString(args.stream, 'stream', 60),
          notes: asOptionalString(args.notes, 'notes', 500),
        };
        return {
          args: normalised,
          summary: `Create class ${normalised.name}${
            normalised.stream ? ` ${normalised.stream}` : ''
          }`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.classes.create(
          {
            name: asString(args.name, 'name', 100),
            stream: asOptionalString(args.stream, 'stream', 60),
            notes: asOptionalString(args.notes, 'notes', 500),
          },
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: update a class ───────────────────────────────────────────────
  private updateClass(): ToolDefinition {
    return {
      name: 'update_class',
      description:
        'Change a class name, stream or notes. Requires approval. Use list_classes for the class ID.',
      kind: 'write',
      riskLevel: 'low',
      roles: MANAGER_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          name: { type: 'string' },
          stream: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['classId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const schoolClass = await this.findClass(
          ctx.organizationId,
          asString(args.classId, 'classId', 100),
        );
        const updates: Record<string, unknown> = {};
        const name = asOptionalString(args.name, 'name', 100);
        const stream = asOptionalString(args.stream, 'stream', 60);
        const notes = asOptionalString(args.notes, 'notes', 500);
        if (name !== undefined) updates.name = name;
        if (stream !== undefined) updates.stream = stream;
        if (notes !== undefined) updates.notes = notes;
        if (Object.keys(updates).length === 0) {
          throw new BadRequestException('No changes were supplied.');
        }
        return {
          args: { classId: schoolClass.id, updates },
          summary: `Update class ${schoolClass.name} (${Object.keys(updates).join(', ')})`,
          diff: { class: schoolClass.name, before: null, after: updates },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const updates = asRecord(args.updates);
        const payload: Record<string, unknown> = {};
        const name = asOptionalString(updates.name, 'name', 100);
        const stream = asOptionalString(updates.stream, 'stream', 60);
        const notes = asOptionalString(updates.notes, 'notes', 500);
        if (name !== undefined) payload.name = name;
        if (stream !== undefined) payload.stream = stream;
        if (notes !== undefined) payload.notes = notes;
        return this.classes.update(
          asString(args.classId, 'classId', 100),
          payload as Partial<CreateSchoolClassDto> as CreateSchoolClassDto,
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: generate fee invoices ────────────────────────────────────────
  private generateFeeInvoices(): ToolDefinition {
    return {
      name: 'generate_fee_invoices',
      description:
        'Generate the term\u2019s fee invoices for every active student with an applicable fee structure. Requires approval. Idempotent: already-invoiced students are skipped.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: { termId: { type: 'string' } },
        required: ['termId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const term = await this.findTerm(
          ctx.organizationId,
          asString(args.termId, 'termId', 100),
        );
        const students = await this.prisma.db.student.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          select: { id: true, classId: true },
        });
        const existing = await this.prisma.db.feeInvoice.findMany({
          where: { termId: term.id, organizationId: ctx.organizationId },
          select: { studentId: true },
        });
        const invoiced = new Set(existing.map((row) => row.studentId));
        const toCreate = students.filter((student) => {
          if (invoiced.has(student.id)) return false;
          return term.feeStructures.some(
            (fs) => fs.classId === null || fs.classId === student.classId,
          );
        }).length;
        return {
          args: { termId: term.id },
          summary: `Generate fee invoices for ${term.name} (${toCreate} student${
            toCreate === 1 ? '' : 's'
          })`,
          diff: {
            before: null,
            after: {
              term: term.name,
              activeStudents: students.length,
              alreadyInvoiced: invoiced.size,
              toCreate,
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.fees.generateForTerm(
          asString(args.termId, 'termId', 100),
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: record a fee payment ─────────────────────────────────────────
  private recordFeePayment(): ToolDefinition {
    return {
      name: 'record_fee_payment',
      description:
        'Record a fee payment against an issued invoice. Requires approval. Use list_fee_invoices to find the invoice ID and balance.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          invoiceId: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string', enum: [...PAYMENT_METHODS] },
          reference: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['invoiceId', 'amount', 'method'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const invoice = await this.findFeeInvoice(
          ctx.organizationId,
          asString(args.invoiceId, 'invoiceId', 100),
        );
        if (
          invoice.status === FeeInvoiceStatus.DRAFT ||
          invoice.status === FeeInvoiceStatus.VOIDED
        ) {
          throw new BadRequestException(
            'Cannot pay a DRAFT or VOIDED invoice.',
          );
        }
        const amount = asPositiveNumber(args.amount, 'amount');
        const method = asEnum(args.method, 'method', PAYMENT_METHODS);
        const reference = asOptionalString(args.reference, 'reference', 100);
        const note = asOptionalString(args.note, 'note', 300);
        const before = feeBalance(invoice);
        return {
          args: { invoiceId: invoice.id, amount, method, reference, note },
          summary: `Record ${method} fee payment of KES ${amount} for ${
            invoice.student.name
          } (${invoice.term.name})`,
          diff: {
            balance: {
              before,
              after: Math.round((before - amount) * 100) / 100,
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.fees.recordPayment(
          asString(args.invoiceId, 'invoiceId', 100),
          {
            amount: asPositiveNumber(args.amount, 'amount'),
            method: asEnum(args.method, 'method', PAYMENT_METHODS),
            reference: asOptionalString(args.reference, 'reference', 100),
            note: asOptionalString(args.note, 'note', 300),
          },
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: issue / void a fee invoice ───────────────────────────────────
  private issueFeeInvoice(): ToolDefinition {
    return {
      name: 'issue_fee_invoice',
      description:
        'Issue a draft fee invoice so it can be paid. Requires approval. Use list_fee_invoices to find the invoice ID.',
      kind: 'write',
      riskLevel: 'low',
      roles: MANAGER_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: { invoiceId: { type: 'string' } },
        required: ['invoiceId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const invoice = await this.findFeeInvoice(
          ctx.organizationId,
          asString(args.invoiceId, 'invoiceId', 100),
        );
        if (invoice.status !== FeeInvoiceStatus.DRAFT) {
          throw new BadRequestException('Only DRAFT invoices can be issued.');
        }
        return {
          args: { invoiceId: invoice.id },
          summary: `Issue fee invoice for ${invoice.student.name} (${invoice.term.name})`,
          diff: {
            status: { before: invoice.status, after: FeeInvoiceStatus.ISSUED },
          },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.fees.issueInvoice(
          asString(args.invoiceId, 'invoiceId', 100),
          ctx.organizationId,
        );
      },
    };
  }

  private voidFeeInvoice(): ToolDefinition {
    return {
      name: 'void_fee_invoice',
      description:
        'Void a fee invoice. Requires approval. Use list_fee_invoices to find the invoice ID.',
      kind: 'write',
      riskLevel: 'high',
      roles: MANAGER_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: { invoiceId: { type: 'string' } },
        required: ['invoiceId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const invoice = await this.findFeeInvoice(
          ctx.organizationId,
          asString(args.invoiceId, 'invoiceId', 100),
        );
        return {
          args: { invoiceId: invoice.id },
          summary: `Void fee invoice for ${invoice.student.name} (${invoice.term.name})`,
          diff: {
            status: { before: invoice.status, after: FeeInvoiceStatus.VOIDED },
          },
          riskLevel: 'high',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.fees.voidInvoice(
          asString(args.invoiceId, 'invoiceId', 100),
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: issue supplies (stock deduction) ─────────────────────────────
  private recordSupplyIssue(): ToolDefinition {
    return {
      name: 'record_supply_issue',
      description:
        'Issue a stock item to a class or student (exercise books, pens), deducting inventory. Requires approval. Use search_inventory for the item ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: SCHOOL,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          quantity: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: {
            id: asString(args.itemId, 'itemId', 100),
            organizationId: ctx.organizationId,
          },
          select: { id: true, name: true, unit: true, quantity: true },
        });
        if (!item) {
          throw new BadRequestException(
            'No matching item in this organization.',
          );
        }
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const before = Number(item.quantity);
        if (before < quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${item.name}. Available: ${before}.`,
          );
        }
        return {
          args: {
            itemId: item.id,
            quantity,
            note: asOptionalString(args.note, 'note', 300),
          },
          summary: `Issue ${quantity} ${item.unit} of ${item.name}`,
          diff: { item: item.name, quantity: { before, after: before - quantity } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.transactions.create(
          {
            itemId: asString(args.itemId, 'itemId', 100),
            type: TransactionTypeDto.SALE,
            quantity: asPositiveNumber(args.quantity, 'quantity'),
            note: asOptionalString(args.note, 'note', 300),
          },
          ctx.organizationId,
          {
            actorId: ctx.userId,
            actorName: 'Assistant (user-approved)',
            actorRole: ctx.role,
          },
        );
      },
    };
  }
}
