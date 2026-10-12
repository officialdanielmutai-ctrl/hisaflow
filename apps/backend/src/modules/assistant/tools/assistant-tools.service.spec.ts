import { BadRequestException } from '@nestjs/common';
import { AssistantToolsService } from './assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

function build(options: { items?: Array<Record<string, unknown>> } = {}) {
  const items = options.items ?? [];
  const db = {
    inventoryItem: {
      findMany: jest.fn(async () => items),
      findFirst: jest.fn(async () => items[0] ?? null),
    },
  };
  const notes = { create: jest.fn(async () => ({ id: 'note_1' })) };
  const transactions = { create: jest.fn(async () => ({ id: 'tx_1' })) };
  const service = new AssistantToolsService(
    { db } as never,
    notes as never,
    transactions as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return { service, db, notes, transactions, byName };
}

describe('AssistantToolsService.get_low_stock', () => {
  it('scopes the query to the organization and returns only low items', async () => {
    const { byName, db } = build({
      items: [
        { id: 'i1', name: 'Maize flour', unit: 'kg', quantity: 2, reorderThreshold: 5 },
        { id: 'i2', name: 'Sugar', unit: 'kg', quantity: 20, reorderThreshold: 5 },
      ],
    });
    const tool = byName('get_low_stock');

    const result = await tool.execute?.({ limit: 10 }, CTX);

    expect(db.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', isActive: true },
      }),
    );
    expect(result).toEqual([
      {
        id: 'i1',
        name: 'Maize flour',
        unit: 'kg',
        quantity: 2,
        reorderThreshold: 5,
      },
    ]);
  });
});

describe('AssistantToolsService.create_note', () => {
  it('validates and summarises without committing', async () => {
    const { byName, notes } = build();
    const tool = byName('create_note');

    const draft = await tool.buildProposal?.({ title: '  Restock  ' }, CTX);

    expect(draft?.args).toEqual({
      title: 'Restock',
      content: undefined,
      importance: 'MEDIUM',
    });
    expect(draft?.summary).toContain('Restock');
    expect(notes.create).not.toHaveBeenCalled();
  });

  it('rejects an empty title', () => {
    const { byName } = build();
    const tool = byName('create_note');
    expect(() => tool.buildProposal?.({ title: '   ' }, CTX)).toThrow(
      BadRequestException,
    );
  });

  it('commits through NotesService with the server identity', async () => {
    const { byName, notes } = build();
    const tool = byName('create_note');

    await tool.commit?.(
      { title: 'Restock', importance: 'HIGH' },
      CTX,
    );

    expect(notes.create).toHaveBeenCalledWith('org_1', 'user_1', {
      title: 'Restock',
      content: undefined,
      importance: 'HIGH',
    });
  });
});

describe('AssistantToolsService.record_sale', () => {
  it('scopes the item lookup and computes a before/after diff', async () => {
    const { byName, db } = build({
      items: [{ id: 'i1', name: 'Maize flour', unit: 'kg', quantity: 20 }],
    });
    const tool = byName('record_sale');

    const draft = await tool.buildProposal?.(
      { itemId: 'i1', quantity: 3 },
      CTX,
    );

    expect(db.inventoryItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'i1', organizationId: 'org_1' },
      }),
    );
    expect(draft?.args).toEqual({ itemId: 'i1', quantity: 3 });
    expect(draft?.diff).toEqual({
      item: 'Maize flour',
      quantity: { before: 20, after: 17 },
    });
  });

  it('refuses an item outside the organization', async () => {
    const { byName } = build({ items: [] });
    const tool = byName('record_sale');
    await expect(
      tool.buildProposal?.({ itemId: 'other_org_item', quantity: 1 }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('commits through TransactionsService as a SALE', async () => {
    const { byName, transactions } = build({
      items: [{ id: 'i1', name: 'Maize flour', unit: 'kg', quantity: 20 }],
    });
    const tool = byName('record_sale');

    await tool.commit?.({ itemId: 'i1', quantity: 3 }, CTX);

    expect(transactions.create).toHaveBeenCalledWith(
      { itemId: 'i1', type: 'SALE', quantity: 3 },
      'org_1',
      expect.objectContaining({
        actorId: 'user_1',
        actorRole: AppRole.OWNER,
      }),
    );
  });
});

describe('AssistantToolsService.record_purchase / record_wastage', () => {
  it('projects a purchase as an increase in quantity', async () => {
    const { byName } = build({
      items: [{ id: 'i1', name: 'Sugar', unit: 'kg', quantity: 10 }],
    });
    const draft = await byName('record_purchase').buildProposal?.(
      { itemId: 'i1', quantity: 5 },
      CTX,
    );

    expect(draft?.args).toEqual({ itemId: 'i1', quantity: 5 });
    expect(draft?.diff).toEqual({
      item: 'Sugar',
      quantity: { before: 10, after: 15 },
    });
  });

  it('records a wastage reason and projects a decrease', async () => {
    const { byName, transactions } = build({
      items: [{ id: 'i1', name: 'Milk', unit: 'l', quantity: 10 }],
    });
    const tool = byName('record_wastage');

    const draft = await tool.buildProposal?.(
      { itemId: 'i1', quantity: 2, wastageReason: 'expired' },
      CTX,
    );

    expect(draft?.args).toEqual({
      itemId: 'i1',
      quantity: 2,
      wastageReason: 'expired',
    });
    expect(draft?.diff).toEqual({
      item: 'Milk',
      quantity: { before: 10, after: 8 },
    });

    await tool.commit?.(
      { itemId: 'i1', quantity: 2, wastageReason: 'expired' },
      CTX,
    );
    expect(transactions.create).toHaveBeenCalledWith(
      { itemId: 'i1', type: 'WASTAGE', quantity: 2, note: 'expired' },
      'org_1',
      expect.objectContaining({ actorId: 'user_1' }),
    );
  });
});
