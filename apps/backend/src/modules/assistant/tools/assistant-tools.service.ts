import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { NotesService } from '../../notes/notes.service';
import { NoteImportance } from '../../notes/dto/create-note.dto';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { AssistantCommsService } from '../comms/assistant-comms.service';
import { AssistantUnsupportedService } from '../unsupported/assistant-unsupported.service';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asLimit,
  asOptionalDate,
  asOptionalNonNegative,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

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

function asImportance(value: unknown): NoteImportance {
  if (value === undefined || value === null) return NoteImportance.MEDIUM;
  if (typeof value !== 'string' || !IMPORTANCE.includes(value as Importance)) {
    throw new BadRequestException(
      `"importance" must be one of ${IMPORTANCE.join(', ')}.`,
    );
  }
  return value as NoteImportance;
}

/**
 * A note needs a title for the list view, but a model asked to "draft a note"
 * often returns only the body. Derive a title from the first non-empty line so
 * the request still becomes a reviewable proposal instead of failing validation
 * and being pasted back as plain text.
 */
function normaliseTitle(
  title: string | undefined,
  content: string | undefined,
): string | undefined {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle.slice(0, 200);
  const body = content?.trim();
  if (!body) return undefined;
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine ?? body).slice(0, 80);
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
  /** Business types this stock movement applies to. Defaults to retail. */
  verticals?: string[];
}

/**
 * DUKA / mini-mart tool set (overhaul Duty 2, Phase B foundation + Phase C
 * first vertical). Writes never mutate here — they build a proposal; only the
 * executor commits through the same domain service the manual UI uses.
 */
@Injectable()
export class AssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly notes: NotesService,
    private readonly transactions: TransactionsService,
    private readonly comms: AssistantCommsService,
    private readonly unsupported: AssistantUnsupportedService,
  ) {}

  all(): ToolDefinition[] {
    return [
      this.getLowStock(),
      this.searchInventory(),
      this.listInventory(),
      this.createNote(),
      this.transactionTool({
        name: 'record_sale',
        description:
          'Record a sale of an inventory item to a customer. Requires approval.',
        type: TransactionTypeDto.SALE,
        direction: 'out',
        verticals: ['DUKA', 'MINI_MART', 'RESTAURANT', 'CHEMIST'],
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
      this.sendEmail(),
      this.sendSms(),
      this.logUnsupportedIntent(),
    ];
  }

  // ── read: low stock ─────────────────────────────────────────────────────
  private getLowStock(): ToolDefinition {
    return {
      name: 'get_low_stock',
      description:
        'List inventory items at or below their reorder threshold. Read-only. Use this to answer what is low or running out; never guess stock figures.',
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
        'Search the organization inventory by product name. Read-only. Use this before quoting a specific item; never invent a match.',
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

  // ── read: list inventory ────────────────────────────────────────────────
  // Added after a production report that the assistant invented products when
  // asked to "pull the details about my stock": there was no read tool that
  // lists inventory without a known product name, so the model filled the gap.
  private listInventory(): ToolDefinition {
    return {
      name: 'list_inventory',
      description:
        'List the organization inventory items and their current quantities. Read-only. Call this before answering any general question about what is in stock. If it returns an empty list, the organization has no inventory items yet — say so and do not invent examples.',
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
        const limit = asLimit(args.limit, 20);
        const items = await this.prisma.db.inventoryItem.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          orderBy: { name: 'asc' },
          take: limit,
          select: {
            id: true,
            name: true,
            unit: true,
            quantity: true,
            reorderThreshold: true,
            costPrice: true,
            sellingPrice: true,
          },
        });
        return items.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: Number(item.quantity),
          reorderThreshold: item.reorderThreshold,
          costPrice:
            item.costPrice === null || item.costPrice === undefined
              ? null
              : Number(item.costPrice),
          sellingPrice:
            item.sellingPrice === null || item.sellingPrice === undefined
              ? null
              : Number(item.sellingPrice),
        }));
      },
    };
  }

  // ── write: note ─────────────────────────────────────────────────────────
  private createNote(): ToolDefinition {
    return {
      name: 'create_note',
      description:
        'Save a note, reminder or task for the team (it appears under Notes). Requires approval. Use this whenever the user asks to create, save, remember or send a note/reminder — never just write the text in your reply.',
      kind: 'write',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF],
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Short title. Optional; derived from the content if omitted.',
          },
          content: {
            type: 'string',
            description: 'The note body. Also accepts "body" or "text".',
          },
          importance: { type: 'string', enum: [...IMPORTANCE] },
          dueDate: {
            type: 'string',
            description:
              'Optional due date/time, ISO 8601 (for example 2026-10-20T09:00:00Z).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const normalised = this.normaliseNoteArgs(asRecord(raw));
        return {
          args: normalised,
          summary: `Create a ${normalised.importance} note: “${normalised.title}”`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const normalised = this.normaliseNoteArgs(asRecord(raw));
        return this.notes.create(ctx.organizationId, ctx.userId, normalised);
      },
    };
  }

  /**
   * Normalise a note draft. A model asked to "draft a note" often returns only
   * the body, and sometimes uses `body`/`text` for it; derive a title so the
   * request still becomes a reviewable proposal instead of failing validation.
   */
  private normaliseNoteArgs(raw: Record<string, unknown>) {
    const content = asOptionalString(
      raw.content ?? raw.body ?? raw.text,
      'content',
      10000,
    );
    const title = normaliseTitle(
      asOptionalString(raw.title, 'title', 200),
      content,
    );
    if (!title) {
      throw new BadRequestException('Provide a note title or content.');
    }
    return {
      title,
      content,
      importance: asImportance(raw.importance),
      dueDate: asOptionalDate(raw.dueDate, 'dueDate'),
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
      // No `verticals`: stock movements are shared across every business type.
      verticals: config.verticals,
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
          select: {
            id: true,
            name: true,
            unit: true,
            quantity: true,
            isComposite: true,
          },
        });
        if (!item) {
          throw new BadRequestException('No matching item in this organization.');
        }
        // A composite menu item holds no stock of its own; selling it must run
        // through the recipe so ingredient stock is deducted.
        if (type === TransactionTypeDto.SALE && item.isComposite) {
          throw new BadRequestException(
            'This is a composite menu item; sell it with record_recipe_consumption (or through a table order) so ingredient stock is deducted.',
          );
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
          expiryDate: { type: 'string', description: 'ISO date.' },
          batchNumber: { type: 'string' },
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
          expiryDate: asOptionalDate(args.expiryDate, 'expiryDate'),
          batchNumber: asOptionalString(args.batchNumber, 'batchNumber', 60),
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
        const name = asString(args.name, 'name', 200);
        const unit = asOptionalString(args.unit, 'unit', 40) ?? 'units';
        const quantity = asOptionalNonNegative(args.quantity, 'quantity') ?? 0;
        const reorderThreshold = asOptionalNonNegative(
          args.reorderThreshold,
          'reorderThreshold',
        );
        const costPrice = asOptionalNonNegative(args.costPrice, 'costPrice');
        const sellingPrice = asOptionalNonNegative(
          args.sellingPrice,
          'sellingPrice',
        );
        const category = asOptionalString(args.category, 'category', 100);
        const expiryDate = asOptionalDate(args.expiryDate, 'expiryDate');
        const batchNumber = asOptionalString(args.batchNumber, 'batchNumber', 60);
        // Expiry/batch metadata is carried on the variant, so create that way.
        if (expiryDate !== undefined || batchNumber !== undefined) {
          return this.inventory.create(
            {
              name,
              category,
              variants: [
                {
                  name: 'Default',
                  unit,
                  quantity,
                  reorderThreshold: reorderThreshold ?? 0,
                  costPrice,
                  sellingPrice,
                  expiryDate,
                  batchNumber,
                },
              ],
            },
            ctx.organizationId,
          );
        }
        return this.inventory.create(
          {
            name,
            unit,
            quantity,
            reorderThreshold,
            costPrice,
            sellingPrice,
            category,
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

  // ── communicate: email / SMS (consent-checked, proposal only) ──────────
  private sendEmail(): ToolDefinition {
    return {
      name: 'send_email',
      description:
        'Draft and send an email to a customer. Requires approval; opt-out consent is checked.',
      kind: 'communicate',
      riskLevel: 'high',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string' },
          recipientName: { type: 'string' },
          subject: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['recipient', 'subject', 'message'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const recipient = asString(args.recipient, 'recipient', 200);
        const subject = asString(args.subject, 'subject', 200);
        const message = asString(args.message, 'message', 2000);
        const recipientName = asOptionalString(
          args.recipientName,
          'recipientName',
          100,
        );
        await this.comms.assertConsent(ctx.organizationId, 'EMAIL', recipient);
        return {
          args: { recipient, recipientName, subject, message },
          summary: `Email ${recipientName ? `${recipientName} ` : ''}<${recipient}>: “${subject}”`,
          diff: {
            before: null,
            after: { channel: 'EMAIL', recipient, subject, message },
          },
          riskLevel: 'high',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.comms.send({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          channel: 'EMAIL',
          recipient: asString(args.recipient, 'recipient', 200),
          subject: asString(args.subject, 'subject', 200),
          message: asString(args.message, 'message', 2000),
        });
      },
    };
  }

  private sendSms(): ToolDefinition {
    return {
      name: 'send_sms',
      description:
        'Draft and send an SMS to a customer. Requires approval; opt-out consent is checked.',
      kind: 'communicate',
      riskLevel: 'high',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string' },
          recipientName: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['recipient', 'message'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const recipient = asString(args.recipient, 'recipient', 40);
        const message = asString(args.message, 'message', 1000);
        const recipientName = asOptionalString(
          args.recipientName,
          'recipientName',
          100,
        );
        await this.comms.assertConsent(ctx.organizationId, 'SMS', recipient);
        return {
          args: { recipient, recipientName, message },
          summary: `SMS ${recipientName ? `${recipientName} ` : ''}(${recipient}): “${message}”`,
          diff: {
            before: null,
            after: { channel: 'SMS', recipient, message },
          },
          riskLevel: 'high',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.comms.send({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          channel: 'SMS',
          recipient: asString(args.recipient, 'recipient', 40),
          message: asString(args.message, 'message', 1000),
        });
      },
    };
  }

  // ── fallback capture (utility, no business side effect) ─────────────────
  private logUnsupportedIntent(): ToolDefinition {
    return {
      name: 'log_unsupported_intent',
      description:
        'Record a request the assistant cannot currently fulfil, so the team can review it. Use this when no other tool fits, then explain the limit and offer the nearest alternative.',
      kind: 'utility',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: { request: { type: 'string' } },
        required: ['request'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.unsupported.record(
          ctx.organizationId,
          ctx.userId,
          asString(args.request, 'request', 1000),
        );
      },
    };
  }
}
