import { BadRequestException } from '@nestjs/common';
import { SubscriberStatus, TicketStatus, WorkOrderStatus } from '@prisma/client';
import { IspAssistantToolsService } from './isp-assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'ISP',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const SUBSCRIBER = {
  id: 'sub_1',
  name: 'John Doe',
  phone: '0712345678',
  status: SubscriberStatus.ACTIVE,
  connectionType: 'PPPOE',
  planId: 'plan_1',
  plan: {
    id: 'plan_1',
    name: 'Home 10Mbps',
    price: 2500,
    billingCycle: 'MONTHLY',
  },
};

type MockFn = jest.Mock;

interface Harness {
  service: IspAssistantToolsService;
  db: {
    subscriber: { findFirst: MockFn; findMany: MockFn };
    servicePlan: { findFirst: MockFn; findMany: MockFn };
    invoice: { findFirst: MockFn; findMany: MockFn };
    inventoryItem: { findFirst: MockFn };
    workOrder: { findFirst: MockFn; findMany: MockFn };
    ticket: { findFirst: MockFn; findMany: MockFn };
  };
  subscribers: { create: MockFn; update: MockFn; updateStatus: MockFn };
  workOrders: { create: MockFn; transition: MockFn };
  tickets: { create: MockFn; transition: MockFn };
  invoices: { generateForSubscriber: MockFn; recordPayment: MockFn };
  equipment: { issue: MockFn };
  byName: (name: string) => ToolDefinition;
}

function build(): Harness {
  const db = {
    subscriber: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    servicePlan: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    invoice: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    inventoryItem: { findFirst: jest.fn(async () => null as unknown) },
    workOrder: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    ticket: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
  };
  const subscribers = {
    create: jest.fn(async () => ({ id: 'sub_new' })),
    update: jest.fn(async () => ({ id: 'sub_1' })),
    updateStatus: jest.fn(async () => ({ id: 'sub_1' })),
  };
  const workOrders = {
    create: jest.fn(async () => ({ id: 'wo_1' })),
    transition: jest.fn(async () => ({ id: 'wo_1' })),
  };
  const tickets = {
    create: jest.fn(async () => ({ id: 'tkt_1' })),
    transition: jest.fn(async () => ({ id: 'tkt_1' })),
  };
  const invoices = {
    generateForSubscriber: jest.fn(async () => ({ id: 'inv_1' })),
    recordPayment: jest.fn(async () => ({ id: 'inv_1' })),
  };
  const equipment = { issue: jest.fn(async () => ({ id: 'eq_1' })) };

  const service = new IspAssistantToolsService(
    { db } as never,
    subscribers as never,
    workOrders as never,
    tickets as never,
    invoices as never,
    equipment as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return {
    service,
    db,
    subscribers,
    workOrders,
    tickets,
    invoices,
    equipment,
    byName,
  };
}

describe('IspAssistantToolsService vertical gating', () => {
  it('gates every ISP tool to the ISP vertical', () => {
    const { service } = build();
    const tools = service.all();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.verticals).toEqual(['ISP']);
    }
  });

  it('restricts financial and status tools to owners and managers', () => {
    const { byName } = build();
    for (const name of [
      'create_subscriber',
      'assign_plan',
      'suspend_subscriber',
      'reactivate_subscriber',
      'churn_subscriber',
      'generate_subscriber_invoice',
      'record_subscriber_payment',
    ]) {
      expect(byName(name).roles).toEqual([AppRole.OWNER, AppRole.MANAGER]);
    }
  });
});

describe('IspAssistantToolsService.search_subscribers', () => {
  it('scopes the query to the organization and searches name or phone', async () => {
    const h = build();
    h.db.subscriber.findMany.mockResolvedValue([
      { id: 'sub_1', name: 'John Doe', phone: '0712' },
    ]);

    const result = await h.byName('search_subscribers').execute?.(
      { query: 'John', limit: 5 },
      CTX,
    );

    expect(h.db.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
        take: 5,
      }),
    );
    expect(result).toEqual([{ id: 'sub_1', name: 'John Doe', phone: '0712' }]);
  });
});

describe('IspAssistantToolsService.list_service_plans', () => {
  it('returns active plans with a numeric price', async () => {
    const h = build();
    h.db.servicePlan.findMany.mockResolvedValue([
      { id: 'plan_1', name: 'Home 10Mbps', price: 2500 },
    ]);

    const result = await h.byName('list_service_plans').execute?.({}, CTX);

    expect(h.db.servicePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', isActive: true },
      }),
    );
    expect(result).toEqual([{ id: 'plan_1', name: 'Home 10Mbps', price: 2500 }]);
  });
});

describe('IspAssistantToolsService.list_overdue_subscribers', () => {
  it('keeps only rows with a positive balance and scopes to the org', async () => {
    const h = build();
    h.db.invoice.findMany.mockResolvedValue([
      {
        id: 'inv_1',
        status: 'ISSUED',
        dueDate: new Date('2026-01-01'),
        adjustmentsTotal: 2500,
        consumptionTotal: 0,
        roomTotal: 0,
        amountPaid: 500,
        subscriber: { id: 'sub_1', name: 'John Doe' },
      },
      {
        id: 'inv_2',
        status: 'PAID',
        dueDate: new Date('2026-01-01'),
        adjustmentsTotal: 2500,
        consumptionTotal: 0,
        roomTotal: 0,
        amountPaid: 2500,
        subscriber: { id: 'sub_2', name: 'Jane' },
      },
    ]);

    const result = (await h.byName('list_overdue_subscribers').execute?.(
      {},
      CTX,
    )) as Array<{ invoiceId: string; balance: number }>;

    expect(h.db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ invoiceId: 'inv_1', balance: 2000 });
  });
});

describe('IspAssistantToolsService.list_open_tickets', () => {
  it('defaults to open tickets scoped to the organization', async () => {
    const h = build();
    await h.byName('list_open_tickets').execute?.({}, CTX);
    expect(h.db.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', status: TicketStatus.OPEN },
      }),
    );
  });
});

describe('IspAssistantToolsService.create_subscriber', () => {
  it('normalises, resolves the plan and does not commit during build', async () => {
    const h = build();
    h.db.servicePlan.findFirst.mockResolvedValue({
      id: 'plan_1',
      name: 'Home 10Mbps',
      price: 2500,
      billingCycle: 'MONTHLY',
    });

    const draft = await h.byName('create_subscriber').buildProposal?.(
      {
        name: '  John Doe ',
        phone: '0712345678',
        email: 'john@example.com',
        planId: 'plan_1',
      },
      CTX,
    );

    expect(draft?.args).toMatchObject({
      name: 'John Doe',
      phone: '0712345678',
      email: 'john@example.com',
      planId: 'plan_1',
      connectionType: 'PPPOE',
    });
    expect(draft?.summary).toContain('Home 10Mbps');
    expect(h.subscribers.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid email address', async () => {
    const h = build();
    await expect(
      h
        .byName('create_subscriber')
        .buildProposal?.(
          { name: 'John', phone: '0712', email: 'not-an-email' },
          CTX,
        ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('commits through SubscribersService with the server organization', async () => {
    const h = build();
    await h.byName('create_subscriber').commit?.(
      { name: 'John Doe', phone: '0712345678' },
      CTX,
    );
    expect(h.subscribers.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ name: 'John Doe', phone: '0712345678' }),
    );
  });
});

describe('IspAssistantToolsService.assign_plan', () => {
  it('shows a before/after plan and commits the update', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);
    h.db.servicePlan.findFirst.mockResolvedValue({
      id: 'plan_2',
      name: 'Home 20Mbps',
      price: 4000,
      billingCycle: 'MONTHLY',
    });

    const draft = await h.byName('assign_plan').buildProposal?.(
      { subscriberId: 'sub_1', planId: 'plan_2' },
      CTX,
    );

    expect(draft?.diff).toEqual({
      plan: { before: 'Home 10Mbps', after: 'Home 20Mbps' },
    });
    expect(draft?.args).toEqual({ subscriberId: 'sub_1', planId: 'plan_2' });

    await h.byName('assign_plan').commit?.(draft?.args ?? {}, CTX);
    expect(h.subscribers.update).toHaveBeenCalledWith('org_1', 'sub_1', {
      planId: 'plan_2',
    });
  });
});

describe('IspAssistantToolsService.setStatus tools', () => {
  it('projects a status change and commits updateStatus', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);

    const draft = await h.byName('suspend_subscriber').buildProposal?.(
      { subscriberId: 'sub_1' },
      CTX,
    );

    expect(draft?.diff).toEqual({
      status: { before: 'ACTIVE', after: 'SUSPENDED' },
    });
    expect(draft?.riskLevel).toBe('medium');

    await h.byName('suspend_subscriber').commit?.({ subscriberId: 'sub_1' }, CTX);
    expect(h.subscribers.updateStatus).toHaveBeenCalledWith(
      'org_1',
      'sub_1',
      SubscriberStatus.SUSPENDED,
    );
  });

  it('marks churn as high risk', () => {
    const h = build();
    expect(h.byName('churn_subscriber').riskLevel).toBe('high');
  });

  it('refuses a subscriber outside the organization', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(null);
    await expect(
      h.byName('suspend_subscriber').buildProposal?.(
        { subscriberId: 'other' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('IspAssistantToolsService.generate_subscriber_invoice', () => {
  it('uses the subscriber plan and commits through the invoice service', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);

    const draft = await h
      .byName('generate_subscriber_invoice')
      .buildProposal?.({ subscriberId: 'sub_1' }, CTX);

    expect(draft?.summary).toContain('Home 10Mbps');
    expect(draft?.diff).toMatchObject({
      after: { subscriber: 'John Doe', plan: 'Home 10Mbps', amount: 2500 },
    });

    await h
      .byName('generate_subscriber_invoice')
      .commit?.({ subscriberId: 'sub_1' }, CTX);
    expect(h.invoices.generateForSubscriber).toHaveBeenCalledWith('org_1', {
      subscriberId: 'sub_1',
      planId: undefined,
      dueDate: undefined,
    });
  });
});

describe('IspAssistantToolsService.record_subscriber_payment', () => {
  it('computes the balance before/after and commits the payment', async () => {
    const h = build();
    h.db.invoice.findFirst.mockResolvedValue({
      id: 'inv_1',
      status: 'ISSUED',
      adjustmentsTotal: 2500,
      consumptionTotal: 0,
      roomTotal: 0,
      amountPaid: 500,
      subscriber: { id: 'sub_1', name: 'John Doe' },
    });

    const draft = await h.byName('record_subscriber_payment').buildProposal?.(
      { invoiceId: 'inv_1', amount: 1000, method: 'mpesa' },
      CTX,
    );

    expect(draft?.diff).toEqual({ balance: { before: 2000, after: 1000 } });
    expect(draft?.args).toMatchObject({ method: 'MPESA' });

    await h.byName('record_subscriber_payment').commit?.(
      draft?.args ?? {},
      CTX,
    );
    expect(h.invoices.recordPayment).toHaveBeenCalledWith(
      'org_1',
      'inv_1',
      expect.objectContaining({ amount: 1000, method: 'MPESA' }),
    );
  });

  it('rejects an unknown payment method', async () => {
    const h = build();
    await expect(
      h
        .byName('record_subscriber_payment')
        .buildProposal?.(
          { invoiceId: 'inv_1', amount: 1000, method: 'crypto' },
          CTX,
        ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('IspAssistantToolsService.issue_equipment', () => {
  it('checks stock, shows the decrease and commits the issue', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);
    h.db.inventoryItem.findFirst.mockResolvedValue({
      id: 'item_1',
      name: 'Router',
      unit: 'units',
      quantity: 5,
    });

    const draft = await h.byName('issue_equipment').buildProposal?.(
      { subscriberId: 'sub_1', itemId: 'item_1', quantity: 2 },
      CTX,
    );

    expect(draft?.diff).toEqual({ item: 'Router', quantity: { before: 5, after: 3 } });
    expect(draft?.summary).toContain('John Doe');

    await h.byName('issue_equipment').commit?.(draft?.args ?? {}, CTX);
    expect(h.equipment.issue).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({
        subscriberId: 'sub_1',
        itemId: 'item_1',
        quantity: 2,
      }),
    );
  });

  it('refuses to issue more than is in stock', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);
    h.db.inventoryItem.findFirst.mockResolvedValue({
      id: 'item_1',
      name: 'Router',
      unit: 'units',
      quantity: 1,
    });
    await expect(
      h.byName('issue_equipment').buildProposal?.(
        { subscriberId: 'sub_1', itemId: 'item_1', quantity: 5 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('IspAssistantToolsService.create_work_order', () => {
  it('builds and commits a work order for the resolved subscriber', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);

    const draft = await h.byName('create_work_order').buildProposal?.(
      { subscriberId: 'sub_1', type: 'installation', technicianName: 'Ali' },
      CTX,
    );

    expect(draft?.args).toMatchObject({
      subscriberId: 'sub_1',
      type: 'INSTALLATION',
      technicianName: 'Ali',
    });

    await h.byName('create_work_order').commit?.(draft?.args ?? {}, CTX);
    expect(h.workOrders.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({
        subscriberId: 'sub_1',
        type: 'INSTALLATION',
        technicianName: 'Ali',
      }),
    );
  });
});

describe('IspAssistantToolsService work order transitions', () => {
  it('shows the status change and commits the transition', async () => {
    const h = build();
    h.db.workOrder.findFirst.mockResolvedValue({
      id: 'wo_1',
      type: 'INSTALLATION',
      status: 'SCHEDULED',
      subscriber: { name: 'John Doe' },
    });

    const draft = await h.byName('complete_work_order').buildProposal?.(
      { workOrderId: 'wo_1' },
      CTX,
    );

    expect(draft?.diff).toEqual({
      status: { before: 'SCHEDULED', after: 'COMPLETED' },
    });

    await h.byName('complete_work_order').commit?.({ workOrderId: 'wo_1' }, CTX);
    expect(h.workOrders.transition).toHaveBeenCalledWith(
      'org_1',
      'wo_1',
      WorkOrderStatus.COMPLETED,
    );
  });
});

describe('IspAssistantToolsService tickets', () => {
  it('creates a ticket through the ticket service', async () => {
    const h = build();
    h.db.subscriber.findFirst.mockResolvedValue(SUBSCRIBER);

    const draft = await h.byName('create_ticket').buildProposal?.(
      { subscriberId: 'sub_1', subject: 'No internet' },
      CTX,
    );

    await h.byName('create_ticket').commit?.(draft?.args ?? {}, CTX);
    expect(h.tickets.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ subscriberId: 'sub_1', subject: 'No internet' }),
    );
  });

  it('resolves a ticket and records the transition', async () => {
    const h = build();
    h.db.ticket.findFirst.mockResolvedValue({
      id: 'tkt_1',
      subject: 'No internet',
      status: 'OPEN',
      subscriber: { name: 'John Doe' },
    });

    const draft = await h.byName('resolve_ticket').buildProposal?.(
      { ticketId: 'tkt_1' },
      CTX,
    );

    expect(draft?.diff).toEqual({
      status: { before: 'OPEN', after: 'RESOLVED' },
    });

    await h.byName('resolve_ticket').commit?.({ ticketId: 'tkt_1' }, CTX);
    expect(h.tickets.transition).toHaveBeenCalledWith(
      'org_1',
      'tkt_1',
      TicketStatus.RESOLVED,
    );
  });
});
