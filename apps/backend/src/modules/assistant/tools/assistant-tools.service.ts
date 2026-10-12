import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { NotesService } from '../../notes/notes.service';
import { NoteImportance } from '../../notes/dto/create-note.dto';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolDefinition } from '../tool.types';

const IMPORTANCE = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Importance = (typeof IMPORTANCE)[number];

const WASTAGE_REASONS = [
  'expired',
  'damaged',
  'stolen',
  'spoiled',
  'broken',
  'contaminated',
  'lost',
  'other',
] as const;
type WastageReason = (typeof WASTAGE_REASONS)[number];

function asRecord(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new BadRequestException('Tool arguments must be an object.');
  }
  return args as Record<string, unknown>;
}

function asString(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`"${field}" is required.`);
  }
  if (value.length > max) {
    throw new BadRequestException(`"${field}" is too long.`);
  }
  return value.trim();
}

function asOptionalString(value: unknown, field: string, max = 2000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException(`"${field}" must be text.`);
  }
  return value.slice(0, max);
}

function asPositiveNumber(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) {
    throw new BadRequestException(`"${field}" must be a positive number.`);
  }
  return num;
}

function asOptionalNonNegative(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num < 0) {
    throw new BadRequestException(`"${field}" must be zero or a positive number.`);
  }
  return num;
}

function asLimit(value: unknown, fallback: number, max = 50): number {
  if (value === undefined) return fallback;
  const requested = asPositiveNumber(value, 'limit');
  return Math.min(max, Math.max(1, Math.floor(requested)));
}

function asImportance(value: unknown): NoteImportance {
  if (value === undefined || value === null) return NoteImportance.MEDIUM;
  if (typeof value !== 'string' || !IMPORTANCE.includes(value as Importance)) {
    throw new BadRequestException(
      `"importance" must be one of ${IMPORTANCE.join(', ')}.`,
    );
  }
  return value as NoteImportance;
}

function asWastageReason(value: unknown): WastageReason {
  if (value === undefined || value === null) return 'other';
  if (typeof value !== 'string' || !WASTAGE_REASONS.includes(value as WastageReason)) {
    throw new BadRequestException(
      `"wastageReason" must be one of ${WASTAGE_REASONS.join(', ')}.`,
    );
  }
  return value as WastageReason;
}

interface TransactionToolConfig {
  name: string;
  description: string;
  type: TransactionTypeDto;
  /** SALE/WASTAGE reduce stock; PURCHASE increases it. */
  direction: 'out' | 'in';
  wastage?: boolean;
}

/**
 * DUKA / mini-mart tool set (overhaul Duty 2, Phase B foundation + Phase C
 * first vertical). Writes never mutate here — they build a proposal; only the
 * executor commits through the same domain service the manual UI uses.
 */
@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly notes: NotesService,
    private readonly transactions: TransactionsService,
  ) {}

  all(): ToolDefinition[] {
    return [
      this.getLowStock(),
      this.searchInventory(),
      this.createNote(),
      this.transactionTool({
        name: 'record_sale',
        description:
          'Record a sale of an inventory item to a customer. Requires approval.',
        type: TransactionTypeDto.SALE,
        direction: 'out',
      }),
      this.transactionTool({
        name: 'record_purchase',
        description:
          'Record stock received or bought from a supplier. Requires approval.',
        type: TransactionTypeDto.PURCHASE,
        direction: 'in',
      }),
      this.transactionTool({
        name: 'record_wastage',
        description:
          'Write off expired, damaged, stolen or spoiled stock. Requires approval.',
        type: TransactionTypeDto.WASTAGE,
        direction: 'out',
        wastage: true,
      }),
      this.createInventoryItem(),
      this.updateInventoryItem(),
    ];
  }

  // ── read: low stock ─────────────────────────────────────────────────────
  private getLowStock(): ToolDefinition {
    return {
      name: 'get_low_stock',
      description:
        'List inventory items at or below their reorder threshold. Read-only.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of items to return (1-50).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const limit = asLimit(args.limit, 10);
        const items = await this.prisma.db.inventoryItem.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          select: {
            id: true,
            name: true,
            unit: true,
            quantity: true,
            reorderThreshold: true,
          },
        });
        return items
          .filter(
            (item) => Number(item.quantity) <= Number(item.reorderThreshold ?? 0),
          )
          .slice(0, limit)
          .map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            quantity: Number(item.quantity),
            reorderThreshold: item.reorderThreshold,
          }));
      },
    };
  }

  // ── read: search inventory ──────────────────────────────────────────────
  private searchInventory(): ToolDefinition {
    return {
      name: 'search_inventory',
      description:
        'Search the organization inventory by product name. Read-only.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product name to search for.' },
          limit: { type: 'number' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const query = asString(args.query, 'query', 100);
        const limit = asLimit(args.limit, 10);
        const items = await this.prisma.db.inventoryItem.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
            name: { contains: query, mode: 'insensitive' },
          },
          take: limit,
          select: { id: true, name: true, unit: true, quantity: true },
        });
        return items.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: Number(item.quantity),
        }));
      },
    };
  }

  // ── write: note ─────────────────────────────────────────────────────────
  private createNote(): ToolDefinition {
    return {
      name: 'create_note',
      description:
        'Create a note, reminder or task for the team. Requires approval.',
      kind: 'write',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF],
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          importance: { type: 'string', enum: [...IMPORTANCE] },
        },
        required: ['title'],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const args = asRecord(raw);
        const normalised = {
          title: asString(args.title, 'title', 200),
          content: asOptionalString(args.content, 'content'),
          importance: asImportance(args.importance),
        };
        return {
          args: normalised,
          summary: `Create a ${normalised.importance} note: “${normalised.title}”`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.notes.create(ctx.organizationId, ctx.userId, {
          title: asString(args.title, 'title', 200),
          content: asOptionalString(args.content, 'content'),
          importance: asImportance(args.importance),
        });
      },
    };
  }

  // ── write: DUKA stock transactions ──────────────────────────────────────
  private transactionTool(config: TransactionToolConfig): ToolDefinition {
    const { name, type, direction, wastage } = config;
    return {
      name,
      description: config.description,
      kind: 'write',
      riskLevel: direction === 'in' ? 'low' : 'medium',
      roles: [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF],
      verticals: ['DUKA', 'MINI_MART'],
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          quantity: { type: 'number' },
          ...(wastage
            ? { wastageReason: { type: 'string', enum: [...WASTAGE_REASONS] } }
            : {}),
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: { id: itemId, organizationId: ctx.organizationId },
          select: { id: true, name: true, unit: true, quantity: true },
        });
        if (!item) {
          throw new BadRequestException('No matching item in this organization.');
        }
        const before = Number(item.quantity);
        const after = direction === 'in' ? before + quantity : before - quantity;
        const verb = wastage ? 'Write off' : direction === 'in' ? 'Receive' : 'Sell';
        return {
          args: wastage
            ? { itemId: item.id, quantity, wastageReason: asWastageReason(args.wastageReason) }
            : { itemId: item.id, quantity },
          summary: `${verb} ${quantity} ${item.unit} of ${item.name}`,
          diff: { item: item.name, quantity: { before, after } },
          riskLevel: direction === 'in' ? 'low' : 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.transactions.create(
          {
            itemId: asString(args.itemId, 'itemId', 100),
            type,
            quantity: asPositiveNumber(args.quantity, 'quantity'),
            note: wastage ? asWastageReason(args.wastageReason) : undefined,
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

  // ── write: new inventory item ───────────────────────────────────────────
  private createInventoryItem(): ToolDefinition {
    return {
      name: 'create_inventory_item',
      description:
        'Create a new inventory item with an opening quantity. Requires approval.',
      kind: 'write',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF],
      verticals: ['DUKA', 'MINI_MART'],
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unit: { type: 'string' },
          quantity: { type: 'number' },
          reorderThreshold: { type: 'number' },
          costPrice: { type: 'number' },
          sellingPrice: { type: 'number' },
          category: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const args = asRecord(raw);
        const name = asString(args.name, 'name', 200);
        const unit = asOptionalString(args.unit, 'unit', 40) ?? 'units';
        const quantity = asOptionalNonNegative(args.quantity, 'quantity') ?? 0;
        const normalised = {
          name,
          unit,
          quantity,
          reorderThreshold: asOptionalNonNegative(
            args.reorderThreshold,
            'reorderThreshold',
          ),
          costPrice: asOptionalNonNegative(args.costPrice, 'costPrice'),
          sellingPrice: asOptionalNonNegative(args.sellingPrice, 'sellingPrice'),
          category: asOptionalString(args.category, 'category', 100),
        };
        return {
          args: normalised,
          summary: `Create new item “${name}” with ${quantity} ${unit} in stock`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.inventory.create(
          {
            name: asString(args.name, 'name', 200),
            unit: asOptionalString(args.unit, 'unit', 40) ?? 'units',
            quantity: asOptionalNonNegative(args.quantity, 'quantity') ?? 0,
            reorderThreshold: asOptionalNonNegative(
              args.reorderThreshold,
              'reorderThreshold',
            ),
            costPrice: asOptionalNonNegative(args.costPrice, 'costPrice'),
            sellingPrice: asOptionalNonNegative(args.sellingPrice, 'sellingPrice'),
            category: asOptionalString(args.category, 'category', 100),
          },
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: update an existing inventory item (variant fields) ───────────
  private updateInventoryItem(): ToolDefinition {
    return {
      name: 'update_inventory_item',
      description:
        'Change an existing inventory item\u2019s name, unit, prices or reorder threshold. Requires approval.',
      kind: 'write',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      verticals: ['DUKA', 'MINI_MART'],
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          name: { type: 'string' },
          unit: { type: 'string' },
          costPrice: { type: 'number' },
          sellingPrice: { type: 'number' },
          reorderThreshold: { type: 'number' },
        },
        required: ['itemId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: { id: itemId, organizationId: ctx.organizationId },
          select: {
            id: true,
            name: true,
            unit: true,
            costPrice: true,
            sellingPrice: true,
            reorderThreshold: true,
          },
        });
        if (!item) {
          throw new BadRequestException('No matching item in this organization.');
        }
        const updates: Record<string, unknown> = {};
        const name = asOptionalString(args.name, 'name', 200);
        const unit = asOptionalString(args.unit, 'unit', 40);
        const costPrice = asOptionalNonNegative(args.costPrice, 'costPrice');
        const sellingPrice = asOptionalNonNegative(args.sellingPrice, 'sellingPrice');
        const reorderThreshold = asOptionalNonNegative(
          args.reorderThreshold,
          'reorderThreshold',
        );
        if (name !== undefined) updates.name = name;
        if (unit !== undefined) updates.unit = unit;
        if (costPrice !== undefined) updates.costPrice = costPrice;
        if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice;
        if (reorderThreshold !== undefined) updates.reorderThreshold = reorderThreshold;
        if (Object.keys(updates).length === 0) {
          throw new BadRequestException('No changes were supplied.');
        }
        return {
          args: { itemId: item.id, updates },
          summary: `Update ${item.name} (${Object.keys(updates).join(', ')})`,
          diff: {
            item: item.name,
            before: {
              name: item.name,
              unit: item.unit,
              costPrice: item.costPrice == null ? null : Number(item.costPrice),
              sellingPrice:
                item.sellingPrice == null ? null : Number(item.sellingPrice),
              reorderThreshold:
                item.reorderThreshold == null
                  ? null
                  : Number(item.reorderThreshold),
            },
            after: updates,
          },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const updates = asRecord(args.updates);
        return this.inventory.updateVariant(
          itemId,
          {
            name: asOptionalString(updates.name, 'name', 200),
            unit: asOptionalString(updates.unit, 'unit', 40),
            costPrice: asOptionalNonNegative(updates.costPrice, 'costPrice'),
            sellingPrice: asOptionalNonNegative(
              updates.sellingPrice,
              'sellingPrice',
            ),
            reorderThreshold: asOptionalNonNegative(
              updates.reorderThreshold,
              'reorderThreshold',
            ),
          },
          ctx.organizationId,
        );
      },
    };
  }
}
