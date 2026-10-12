import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ConnectionType,
  SubscriberStatus,
  TicketStatus,
  WorkOrderStatus,
  WorkOrderType,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { SubscribersService } from '../../isp/subscribers/subscribers.service';
import { WorkOrdersService } from '../../isp/work-orders/work-orders.service';
import { TicketsService } from '../../isp/tickets/tickets.service';
import { IspInvoicesService } from '../../isp/invoices/isp-invoices.service';
import { EquipmentService } from '../../isp/equipment/equipment.service';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asEnum,
  asLimit,
  asOptionalDate,
  asOptionalEmail,
  asOptionalEnum,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

const CONNECTION_TYPES = Object.values(ConnectionType);
const WORK_ORDER_TYPES = Object.values(WorkOrderType);
const PAYMENT_METHODS = ['MPESA', 'CASH', 'CARD'] as const;

const ISP = ['ISP'];
const STAFF_ROLES = [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF];
const MANAGER_ROLES = [AppRole.OWNER, AppRole.MANAGER];

interface InvoiceTotals {
  adjustmentsTotal: unknown;
  consumptionTotal: unknown;
  roomTotal: unknown;
  amountPaid: unknown;
}

/** Invoice total (plan + consumption + rooms) minus what has been paid. */
function balanceOf(invoice: InvoiceTotals): number {
  const total =
    Number(invoice.adjustmentsTotal) +
    Number(invoice.consumptionTotal) +
    Number(invoice.roomTotal);
  return Math.round((total - Number(invoice.amountPaid)) * 100) / 100;
}

function planSummary(plan: {
  name: string;
  price: unknown;
  billingCycle: string;
}): string {
  const amount = new Intl.NumberFormat('en-KE').format(Number(plan.price));
  return `${plan.name} (KES ${amount}/${plan.billingCycle.toLowerCase()})`;
}

/**
 * ISP / WISP tool set (overhaul Duty 2, Phase E — remaining verticals).
 *
 * Same contract as the DUKA set: `read` tools run immediately, `write` tools
 * only build a proposal, and the executor commits through the same ISP domain
 * services the manual UI uses. Every tool is gated to `verticals: ['ISP']`.
 */
@Injectable()
export class IspAssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscribers: SubscribersService,
    private readonly workOrders: WorkOrdersService,
    private readonly tickets: TicketsService,
    private readonly invoices: IspInvoicesService,
    private readonly equipment: EquipmentService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // reads
      this.searchSubscribers(),
      this.listServicePlans(),
      this.listSubscriberInvoices(),
      this.listWorkOrders(),
      this.listOverdueSubscribers(),
      this.listOpenTickets(),
      // writes
      this.createSubscriber(),
      this.assignPlan(),
      this.setStatus('suspend_subscriber', 'Suspend', SubscriberStatus.SUSPENDED, 'medium'),
      this.setStatus('reactivate_subscriber', 'Reactivate', SubscriberStatus.ACTIVE, 'medium'),
      this.setStatus('churn_subscriber', 'Mark as churned', SubscriberStatus.CHURNED, 'high'),
      this.generateSubscriberInvoice(),
      this.recordSubscriberPayment(),
      this.issueEquipment(),
      this.createWorkOrder(),
      this.transitionWorkOrder('start_work_order', 'Start', WorkOrderStatus.IN_PROGRESS),
      this.transitionWorkOrder('complete_work_order', 'Complete', WorkOrderStatus.COMPLETED),
      this.createTicket(),
      this.resolveTicket(),
    ];
  }

  // ── scoped lookups ──────────────────────────────────────────────────────
  private async findSubscriber(organizationId: string, id: string) {
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        connectionType: true,
        planId: true,
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            billingCycle: true,
          },
        },
      },
    });
    if (!subscriber) {
      throw new BadRequestException(
        'No matching subscriber in this organization.',
      );
    }
    return subscriber;
  }

  private async findPlan(organizationId: string, id: string) {
    const plan = await this.prisma.db.servicePlan.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        price: true,
        billingCycle: true,
        isActive: true,
      },
    });
    if (!plan) {
      throw new BadRequestException(
        'No matching service plan in this organization.',
      );
    }
    return plan;
  }

  // ── read: subscribers ───────────────────────────────────────────────────
  private searchSubscribers(): ToolDefinition {
    return {
      name: 'search_subscribers',
      description:
        'Search ISP subscribers by name or phone number. Read-only. Use this to resolve a subscriber name to its ID before a write.',
      kind: 'read',
      riskLevel: 'low',
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Subscriber name or phone.' },
          limit: { type: 'number' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const query = asString(args.query, 'query', 100);
        const limit = asLimit(args.limit, 10);
        return this.prisma.db.subscriber.findMany({
          where: {
            organizationId: ctx.organizationId,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          },
          orderBy: { name: 'asc' },
          take: limit,
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            connectionType: true,
            plan: { select: { id: true, name: true } },
          },
        });
      },
    };
  }

  // ── read: service plans ─────────────────────────────────────────────────
  private listServicePlans(): ToolDefinition {
    return {
      name: 'list_service_plans',
      description:
        'List the organization\u2019s active ISP service plans. Read-only. Use this to resolve a plan name to its ID before assigning a plan or generating an invoice.',
      kind: 'read',
      riskLevel: 'low',
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async (_raw, ctx) => {
        const plans = await this.prisma.db.servicePlan.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          orderBy: { price: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            billingCycle: true,
            connectionType: true,
            speedMbps: true,
          },
        });
        return plans.map((plan) => ({ ...plan, price: Number(plan.price) }));
      },
    };
  }

  // ── read: subscriber invoices ───────────────────────────────────────────
  private listSubscriberInvoices(): ToolDefinition {
    return {
      name: 'list_subscriber_invoices',
      description:
        'List recent invoices for one subscriber with their outstanding balance. Read-only. Use this to resolve an invoice ID before recording a payment.',
      kind: 'read',
      riskLevel: 'low',
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          subscriberId: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['subscriberId'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const limit = asLimit(args.limit, 10);
        await this.findSubscriber(ctx.organizationId, subscriberId);
        const invoices = await this.prisma.db.invoice.findMany({
          where: { organizationId: ctx.organizationId, subscriberId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            status: true,
            dueDate: true,
            issuedAt: true,
            adjustmentsTotal: true,
            consumptionTotal: true,
            roomTotal: true,
            amountPaid: true,
            plan: { select: { name: true } },
          },
        });
        return invoices.map((invoice) => ({
          id: invoice.id,
          status: invoice.status,
          dueDate: invoice.dueDate,
          issuedAt: invoice.issuedAt,
          plan: invoice.plan?.name ?? null,
          total: balanceOf({ ...invoice, amountPaid: 0 }),
          amountPaid: Number(invoice.amountPaid),
          balance: balanceOf(invoice),
        }));
      },
    };
  }

  // ── read: work orders ───────────────────────────────────────────────────
  private listWorkOrders(): ToolDefinition {
    return {
      name: 'list_work_orders',
      description:
        'List ISP work orders (installations, repairs, relocations), optionally filtered by status or subscriber. Read-only. Use this to resolve a work order ID before starting or completing it.',
      kind: 'read',
      riskLevel: 'low',
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: Object.values(WorkOrderStatus) },
          subscriberId: { type: 'string' },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const status = asOptionalEnum(
          args.status,
          'status',
          Object.values(WorkOrderStatus),
        );
        const subscriberId = asOptionalString(
          args.subscriberId,
          'subscriberId',
          100,
        );
        const limit = asLimit(args.limit, 10);
        const orders = await this.prisma.db.workOrder.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(status ? { status } : {}),
            ...(subscriberId ? { subscriberId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            type: true,
            status: true,
            scheduledAt: true,
            technicianName: true,
            subscriber: { select: { id: true, name: true } },
          },
        });
        return orders;
      },
    };
  }

  // ── read: overdue subscribers ───────────────────────────────────────────
  private listOverdueSubscribers(): ToolDefinition {
    return {
      name: 'list_overdue_subscribers',
      description:
        'List subscribers with an unpaid invoice past its due date, with the outstanding balance. Read-only.',
      kind: 'read',
      riskLevel: 'low',
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const limit = asLimit(args.limit, 10);
        const invoices = await this.prisma.db.invoice.findMany({
          where: {
            organizationId: ctx.organizationId,
            subscriberId: { not: null },
            dueDate: { lt: new Date() },
            status: { in: ['DRAFT', 'ISSUED', 'PARTIAL'] },
          },
          orderBy: { dueDate: 'asc' },
          take: limit * 2,
          select: {
            id: true,
            status: true,
            dueDate: true,
            adjustmentsTotal: true,
            consumptionTotal: true,
            roomTotal: true,
            amountPaid: true,
            subscriber: {
              select: { id: true, name: true, phone: true, status: true },
            },
          },
        });
        return invoices
          .map((invoice) => ({
            invoiceId: invoice.id,
            subscriber: invoice.subscriber,
            dueDate: invoice.dueDate,
            status: invoice.status,
            balance: balanceOf(invoice),
          }))
          .filter((row) => row.balance > 0)
          .slice(0, limit);
      },
    };
  }

  // ── read: open tickets ──────────────────────────────────────────────────
  private listOpenTickets(): ToolDefinition {
    return {
      name: 'list_open_tickets',
      description:
        'List ISP support tickets, by default the open ones. Read-only. Use this to resolve a ticket ID before resolving it.',
      kind: 'read',
      riskLevel: 'low',
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: Object.values(TicketStatus) },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const status = asOptionalEnum(
          args.status,
          'status',
          Object.values(TicketStatus),
        );
        const limit = asLimit(args.limit, 10);
        return this.prisma.db.ticket.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: status ?? TicketStatus.OPEN,
          },
          orderBy: { createdAt: 'asc' },
          take: limit,
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
            subscriber: { select: { id: true, name: true, phone: true } },
          },
        });
      },
    };
  }

  // ── write: create a subscriber ──────────────────────────────────────────
  private createSubscriber(): ToolDefinition {
    return {
      name: 'create_subscriber',
      description:
        'Create a new ISP subscriber. Requires approval. Optionally assign an existing plan by ID (use list_service_plans).',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          connectionType: { type: 'string', enum: CONNECTION_TYPES },
          planId: { type: 'string' },
        },
        required: ['name', 'phone'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const name = asString(args.name, 'name', 200);
        const phone = asString(args.phone, 'phone', 40);
        const email = asOptionalEmail(args.email);
        const address = asOptionalString(args.address, 'address', 500);
        const connectionType =
          asOptionalEnum(args.connectionType, 'connectionType', CONNECTION_TYPES) ??
          ConnectionType.PPPOE;
        const planId = asOptionalString(args.planId, 'planId', 100);
        let planName: string | null = null;
        if (planId) {
          const plan = await this.findPlan(ctx.organizationId, planId);
          planName = plan.name;
        }
        const normalised = {
          name,
          phone,
          email,
          address,
          connectionType,
          planId,
        };
        return {
          args: normalised,
          summary: `Create subscriber ${name} (${phone})${planName ? ` on ${planName}` : ''}`,
          diff: { before: null, after: normalised },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.subscribers.create(ctx.organizationId, {
          name: asString(args.name, 'name', 200),
          phone: asString(args.phone, 'phone', 40),
          email: asOptionalEmail(args.email),
          address: asOptionalString(args.address, 'address', 500),
          connectionType:
            asOptionalEnum(
              args.connectionType,
              'connectionType',
              CONNECTION_TYPES,
            ) ?? ConnectionType.PPPOE,
          planId: asOptionalString(args.planId, 'planId', 100),
        });
      },
    };
  }

  // ── write: assign a plan ────────────────────────────────────────────────
  private assignPlan(): ToolDefinition {
    return {
      name: 'assign_plan',
      description:
        'Change the service plan assigned to a subscriber. Requires approval. Use list_service_plans to find the plan ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          subscriberId: { type: 'string' },
          planId: { type: 'string' },
        },
        required: ['subscriberId', 'planId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const planId = asString(args.planId, 'planId', 100);
        const subscriber = await this.findSubscriber(
          ctx.organizationId,
          subscriberId,
        );
        const plan = await this.findPlan(ctx.organizationId, planId);
        return {
          args: { subscriberId: subscriber.id, planId: plan.id },
          summary: `Move ${subscriber.name} to ${planSummary(plan)}`,
          diff: {
            plan: {
              before: subscriber.plan ? subscriber.plan.name : 'None',
              after: plan.name,
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.subscribers.update(
          ctx.organizationId,
          asString(args.subscriberId, 'subscriberId', 100),
          { planId: asString(args.planId, 'planId', 100) },
        );
      },
    };
  }

  // ── write: suspend / reactivate / churn ─────────────────────────────────
  private setStatus(
    name: string,
    verb: string,
    status: SubscriberStatus,
    riskLevel: 'medium' | 'high',
  ): ToolDefinition {
    return {
      name,
      description: `${verb} a subscriber. Requires approval. Use search_subscribers to find the subscriber ID.`,
      kind: 'write',
      riskLevel,
      roles: MANAGER_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: { subscriberId: { type: 'string' } },
        required: ['subscriberId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const subscriber = await this.findSubscriber(
          ctx.organizationId,
          subscriberId,
        );
        return {
          args: { subscriberId: subscriber.id },
          summary: `${verb} ${subscriber.name}`,
          diff: { status: { before: subscriber.status, after: status } },
          riskLevel,
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.subscribers.updateStatus(
          ctx.organizationId,
          asString(args.subscriberId, 'subscriberId', 100),
          status,
        );
      },
    };
  }

  // ── write: generate a subscriber invoice ────────────────────────────────
  private generateSubscriberInvoice(): ToolDefinition {
    return {
      name: 'generate_subscriber_invoice',
      description:
        'Generate the plan invoice for a subscriber. Requires approval. Uses the subscriber\u2019s current plan unless a plan ID is given.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          subscriberId: { type: 'string' },
          planId: { type: 'string' },
          dueDate: { type: 'string', description: 'ISO date.' },
        },
        required: ['subscriberId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const planId = asOptionalString(args.planId, 'planId', 100);
        const dueDate = asOptionalDate(args.dueDate, 'dueDate');
        const subscriber = await this.findSubscriber(
          ctx.organizationId,
          subscriberId,
        );
        const plan = planId
          ? await this.findPlan(ctx.organizationId, planId)
          : subscriber.plan;
        const amount = plan ? Number(plan.price) : 0;
        return {
          args: { subscriberId: subscriber.id, planId, dueDate },
          summary: `Generate invoice for ${subscriber.name}${
            plan ? ` \u2014 ${planSummary(plan)}` : ''
          }`,
          diff: {
            before: null,
            after: {
              subscriber: subscriber.name,
              plan: plan ? plan.name : 'None',
              amount,
              dueDate: dueDate ?? 'not set',
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.invoices.generateForSubscriber(ctx.organizationId, {
          subscriberId: asString(args.subscriberId, 'subscriberId', 100),
          planId: asOptionalString(args.planId, 'planId', 100),
          dueDate: asOptionalDate(args.dueDate, 'dueDate'),
        });
      },
    };
  }

  // ── write: record a subscriber payment ──────────────────────────────────
  private recordSubscriberPayment(): ToolDefinition {
    return {
      name: 'record_subscriber_payment',
      description:
        'Record a payment against one ISP invoice. Requires approval. Use list_subscriber_invoices to find the invoice ID and its balance.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          invoiceId: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string', enum: [...PAYMENT_METHODS] },
          note: { type: 'string' },
        },
        required: ['invoiceId', 'amount', 'method'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const invoiceId = asString(args.invoiceId, 'invoiceId', 100);
        const amount = asPositiveNumber(args.amount, 'amount');
        const method = asEnum(args.method, 'method', PAYMENT_METHODS);
        const note = asOptionalString(args.note, 'note', 300);
        const invoice = await this.prisma.db.invoice.findFirst({
          where: { id: invoiceId, organizationId: ctx.organizationId },
          select: {
            id: true,
            status: true,
            adjustmentsTotal: true,
            consumptionTotal: true,
            roomTotal: true,
            amountPaid: true,
            subscriber: { select: { id: true, name: true } },
          },
        });
        if (!invoice) {
          throw new BadRequestException(
            'No matching invoice in this organization.',
          );
        }
        const before = balanceOf(invoice);
        const after = Math.round((before - amount) * 100) / 100;
        return {
          args: { invoiceId: invoice.id, amount, method, note },
          summary: `Record ${method} payment of KES ${amount} for ${
            invoice.subscriber?.name ?? 'subscriber'
          }`,
          diff: { balance: { before, after } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.invoices.recordPayment(
          ctx.organizationId,
          asString(args.invoiceId, 'invoiceId', 100),
          {
            amount: asPositiveNumber(args.amount, 'amount'),
            method: asEnum(args.method, 'method', PAYMENT_METHODS),
            note: asOptionalString(args.note, 'note', 300),
          },
        );
      },
    };
  }

  // ── write: issue equipment ──────────────────────────────────────────────
  private issueEquipment(): ToolDefinition {
    return {
      name: 'issue_equipment',
      description:
        'Issue equipment (router, ONT, cable) to a subscriber, deducting it from inventory. Requires approval. Use search_inventory for the item ID and search_subscribers for the subscriber ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          subscriberId: { type: 'string' },
          itemId: { type: 'string' },
          quantity: { type: 'number' },
          workOrderId: { type: 'string' },
          notes: { type: 'string' },
          chargeToInvoice: { type: 'boolean' },
        },
        required: ['subscriberId', 'itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const itemId = asString(args.itemId, 'itemId', 100);
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const workOrderId = asOptionalString(args.workOrderId, 'workOrderId', 100);
        const notes = asOptionalString(args.notes, 'notes', 500);
        const chargeToInvoice =
          typeof args.chargeToInvoice === 'boolean'
            ? args.chargeToInvoice
            : undefined;

        const subscriber = await this.findSubscriber(
          ctx.organizationId,
          subscriberId,
        );
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: { id: itemId, organizationId: ctx.organizationId },
          select: { id: true, name: true, unit: true, quantity: true },
        });
        if (!item) {
          throw new BadRequestException('No matching item in this organization.');
        }
        const before = Number(item.quantity);
        if (before < quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${item.name}. Available: ${before}.`,
          );
        }
        const after = before - quantity;
        return {
          args: {
            subscriberId: subscriber.id,
            itemId: item.id,
            quantity,
            workOrderId,
            notes,
            chargeToInvoice,
          },
          summary: `Issue ${quantity} ${item.unit} of ${item.name} to ${subscriber.name}${
            chargeToInvoice ? ' (charge to invoice)' : ''
          }`,
          diff: {
            item: item.name,
            quantity: { before, after },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.equipment.issue(ctx.organizationId, {
          subscriberId: asString(args.subscriberId, 'subscriberId', 100),
          itemId: asString(args.itemId, 'itemId', 100),
          quantity: asPositiveNumber(args.quantity, 'quantity'),
          workOrderId: asOptionalString(args.workOrderId, 'workOrderId', 100),
          notes: asOptionalString(args.notes, 'notes', 500),
          chargeToInvoice:
            typeof args.chargeToInvoice === 'boolean'
              ? args.chargeToInvoice
              : undefined,
        });
      },
    };
  }

  // ── write: create a work order ──────────────────────────────────────────
  private createWorkOrder(): ToolDefinition {
    return {
      name: 'create_work_order',
      description:
        'Create an installation, repair or relocation work order for a subscriber. Requires approval.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          subscriberId: { type: 'string' },
          type: { type: 'string', enum: WORK_ORDER_TYPES },
          scheduledAt: { type: 'string', description: 'ISO date.' },
          technicianName: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['subscriberId', 'type'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const type = asEnum(args.type, 'type', WORK_ORDER_TYPES);
        const scheduledAt = asOptionalDate(args.scheduledAt, 'scheduledAt');
        const technicianName = asOptionalString(
          args.technicianName,
          'technicianName',
          100,
        );
        const notes = asOptionalString(args.notes, 'notes', 500);
        const subscriber = await this.findSubscriber(
          ctx.organizationId,
          subscriberId,
        );
        const normalised = {
          subscriberId: subscriber.id,
          type,
          scheduledAt,
          technicianName,
          notes,
        };
        return {
          args: normalised,
          summary: `Create ${type.toLowerCase()} work order for ${subscriber.name}${
            scheduledAt ? ` on ${scheduledAt.slice(0, 10)}` : ''
          }`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.workOrders.create(ctx.organizationId, {
          subscriberId: asString(args.subscriberId, 'subscriberId', 100),
          type: asEnum(args.type, 'type', WORK_ORDER_TYPES),
          scheduledAt: asOptionalDate(args.scheduledAt, 'scheduledAt'),
          technicianName: asOptionalString(
            args.technicianName,
            'technicianName',
            100,
          ),
          notes: asOptionalString(args.notes, 'notes', 500),
        });
      },
    };
  }

  // ── write: work order transitions ───────────────────────────────────────
  private transitionWorkOrder(
    name: string,
    verb: string,
    status: WorkOrderStatus,
  ): ToolDefinition {
    return {
      name,
      description: `${verb} a work order. Requires approval. Use list_work_orders to find the work order ID.`,
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: { workOrderId: { type: 'string' } },
        required: ['workOrderId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const workOrderId = asString(args.workOrderId, 'workOrderId', 100);
        const order = await this.prisma.db.workOrder.findFirst({
          where: { id: workOrderId, organizationId: ctx.organizationId },
          select: {
            id: true,
            type: true,
            status: true,
            subscriber: { select: { name: true } },
          },
        });
        if (!order) {
          throw new BadRequestException(
            'No matching work order in this organization.',
          );
        }
        return {
          args: { workOrderId: order.id },
          summary: `${verb} ${order.type.toLowerCase()} work order for ${
            order.subscriber?.name ?? 'subscriber'
          }`,
          diff: { status: { before: order.status, after: status } },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.workOrders.transition(
          ctx.organizationId,
          asString(args.workOrderId, 'workOrderId', 100),
          status,
        );
      },
    };
  }

  // ── write: create a ticket ──────────────────────────────────────────────
  private createTicket(): ToolDefinition {
    return {
      name: 'create_ticket',
      description:
        'Log a support ticket against a subscriber. Requires approval.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: {
          subscriberId: { type: 'string' },
          subject: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['subscriberId', 'subject'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const subscriberId = asString(args.subscriberId, 'subscriberId', 100);
        const subject = asString(args.subject, 'subject', 200);
        const description = asOptionalString(args.description, 'description', 2000);
        const subscriber = await this.findSubscriber(
          ctx.organizationId,
          subscriberId,
        );
        const normalised = {
          subscriberId: subscriber.id,
          subject,
          description,
        };
        return {
          args: normalised,
          summary: `Log ticket for ${subscriber.name}: \u201c${subject}\u201d`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.tickets.create(ctx.organizationId, {
          subscriberId: asString(args.subscriberId, 'subscriberId', 100),
          subject: asString(args.subject, 'subject', 200),
          description: asOptionalString(args.description, 'description', 2000),
        });
      },
    };
  }

  // ── write: resolve a ticket ─────────────────────────────────────────────
  private resolveTicket(): ToolDefinition {
    return {
      name: 'resolve_ticket',
      description:
        'Resolve a support ticket. Requires approval. Use list_open_tickets to find the ticket ID.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: ISP,
      parameters: {
        type: 'object',
        properties: { ticketId: { type: 'string' } },
        required: ['ticketId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const ticketId = asString(args.ticketId, 'ticketId', 100);
        const ticket = await this.prisma.db.ticket.findFirst({
          where: { id: ticketId, organizationId: ctx.organizationId },
          select: {
            id: true,
            subject: true,
            status: true,
            subscriber: { select: { name: true } },
          },
        });
        if (!ticket) {
          throw new BadRequestException(
            'No matching ticket in this organization.',
          );
        }
        return {
          args: { ticketId: ticket.id },
          summary: `Resolve ticket \u201c${ticket.subject}\u201d for ${
            ticket.subscriber?.name ?? 'subscriber'
          }`,
          diff: { status: { before: ticket.status, after: TicketStatus.RESOLVED } },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.tickets.transition(
          ctx.organizationId,
          asString(args.ticketId, 'ticketId', 100),
          TicketStatus.RESOLVED,
        );
      },
    };
  }
}
