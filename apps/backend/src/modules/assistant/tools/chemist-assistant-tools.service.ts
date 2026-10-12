import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { StockBatchesService } from '../../stock-batches/stock-batches.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asDate,
  asLimit,
  asOptionalNonNegative,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

const CHEMIST = ['CHEMIST'];
const STAFF_ROLES = [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF];

function dayLabel(iso: Date): string {
  return iso.toISOString().slice(0, 10);
}

/**
 * CHEMIST tool set (overhaul Duty 2, Phase E — final vertical).
 *
 * Same contract as the other verticals: `read` tools run immediately, `write`
 * tools only build proposals, and the executor commits through the same
 * stock-batches / transactions services the manual UI uses.
 *
 * Generic `record_sale` / `record_purchase` / `record_wastage` are shared and
 * widened to chemists there; `TransactionsService` already deducts stock FIFO
 * from batches. This provider adds batch receiving, expiry listing and
 * batch-specific write-off.
 */
@Injectable()
export class ChemistAssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockBatches: StockBatchesService,
    private readonly transactions: TransactionsService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // reads
      this.listExpiringBatches(),
      this.getDrugInfo(),
      // writes
      this.receiveStockBatch(),
      this.recordExpiryWriteoff(),
    ];
  }

  // ── scoped lookups ──────────────────────────────────────────────────────
  private async findItem(organizationId: string, id: string) {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, unit: true, quantity: true },
    });
    if (!item) {
      throw new BadRequestException(
        'No matching item in this organization.',
      );
    }
    return item;
  }

  private async findBatch(organizationId: string, id: string) {
    const batch = await this.prisma.db.stockBatch.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        batchNumber: true,
        quantity: true,
        expiryDate: true,
        inventoryItemId: true,
        inventoryItem: {
          select: { id: true, name: true, unit: true, quantity: true },
        },
      },
    });
    if (!batch) {
      throw new BadRequestException(
        'No matching stock batch in this organization.',
      );
    }
    return batch;
  }

  // ── read: expiring batches ──────────────────────────────────────────────
  private listExpiringBatches(): ToolDefinition {
    return {
      name: 'list_expiring_batches',
      description:
        'List medicine batches that have expired or will expire within N days (default 30), earliest first. Read-only. Use this to resolve a batch ID before writing it off.',
      kind: 'read',
      riskLevel: 'low',
      verticals: CHEMIST,
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look-ahead window in days.' },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const days =
          args.days === undefined
            ? 30
            : Math.min(365, Math.floor(asPositiveNumber(args.days, 'days')));
        const limit = asLimit(args.limit, 20);
        const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const batches = await this.prisma.db.stockBatch.findMany({
          where: {
            organizationId: ctx.organizationId,
            quantity: { gt: 0 },
            expiryDate: { lte: horizon },
          },
          orderBy: { expiryDate: 'asc' },
          take: limit,
          select: {
            id: true,
            batchNumber: true,
            quantity: true,
            expiryDate: true,
            inventoryItemId: true,
            inventoryItem: { select: { name: true, unit: true } },
          },
        });
        const now = Date.now();
        return {
          days,
          batches: batches.map((batch) => ({
            id: batch.id,
            itemId: batch.inventoryItemId,
            item: batch.inventoryItem.name,
            unit: batch.inventoryItem.unit,
            batchNumber: batch.batchNumber,
            quantity: Number(batch.quantity),
            expiryDate: batch.expiryDate,
            expired: batch.expiryDate.getTime() < now,
          })),
        };
      },
    };
  }

  // ── read: drug / item lookup ────────────────────────────────────────────
  private getDrugInfo(): ToolDefinition {
    return {
      name: 'get_drug_info',
      description:
        'Look up a medicine/item in this organization\u2019s inventory by name, with price, stock and batch/expiry. Read-only. This is the org\u2019s own catalogue, not an external drug database.',
      kind: 'read',
      riskLevel: 'low',
      verticals: CHEMIST,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
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
          orderBy: { name: 'asc' },
          take: limit,
          select: {
            id: true,
            name: true,
            unit: true,
            quantity: true,
            costPrice: true,
            sellingPrice: true,
            batchNumber: true,
            expiryDate: true,
          },
        });
        return items.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: Number(item.quantity),
          costPrice: item.costPrice == null ? null : Number(item.costPrice),
          sellingPrice:
            item.sellingPrice == null ? null : Number(item.sellingPrice),
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
        }));
      },
    };
  }

  // ── write: receive a stock batch ────────────────────────────────────────
  private receiveStockBatch(): ToolDefinition {
    return {
      name: 'receive_stock_batch',
      description:
        'Receive a medicine batch (batch number + expiry) and add it to stock. Requires approval. Use search_inventory or get_drug_info for the item ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: CHEMIST,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          batchNumber: { type: 'string' },
          expiryDate: { type: 'string', description: 'ISO date.' },
          quantity: { type: 'number' },
          costPrice: { type: 'number' },
        },
        required: ['itemId', 'batchNumber', 'expiryDate', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        );
        const batchNumber = asString(args.batchNumber, 'batchNumber', 60);
        const expiryDate = asDate(args.expiryDate, 'expiryDate');
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const costPrice = asOptionalNonNegative(args.costPrice, 'costPrice');
        const before = Number(item.quantity);
        return {
          args: {
            itemId: item.id,
            batchNumber,
            expiryDate,
            quantity,
            costPrice,
          },
          summary: `Receive ${quantity} ${item.unit} of ${item.name} (batch ${batchNumber}, expires ${dayLabel(
            new Date(expiryDate),
          )})`,
          diff: {
            [item.name]: { before, after: before + quantity },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.stockBatches.create(
          {
            inventoryItemId: asString(args.itemId, 'itemId', 100),
            batchNumber: asString(args.batchNumber, 'batchNumber', 60),
            expiryDate: asDate(args.expiryDate, 'expiryDate'),
            quantity: asPositiveNumber(args.quantity, 'quantity'),
            costPrice: asOptionalNonNegative(args.costPrice, 'costPrice'),
          },
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: expiry write-off ─────────────────────────────────────────────
  private recordExpiryWriteoff(): ToolDefinition {
    return {
      name: 'record_expiry_writeoff',
      description:
        'Write off an expired (or unusable) batch, deducting its stock. Requires approval. Use list_expiring_batches to find the batch ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: CHEMIST,
      parameters: {
        type: 'object',
        properties: {
          batchId: { type: 'string' },
          reason: {
            type: 'string',
            enum: ['expired', 'damaged', 'contaminated', 'other'],
          },
        },
        required: ['batchId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const batch = await this.findBatch(
          ctx.organizationId,
          asString(args.batchId, 'batchId', 100),
        );
        const quantity = Number(batch.quantity);
        if (quantity <= 0) {
          throw new BadRequestException(
            'This batch is already empty; nothing to write off.',
          );
        }
        const reason = asOptionalString(args.reason, 'reason', 40) ?? 'expired';
        const item = batch.inventoryItem;
        const before = Number(item.quantity);
        return {
          args: { batchId: batch.id, reason },
          summary: `Write off ${quantity} ${item.unit} of ${item.name} (batch ${
            batch.batchNumber
          }, expires ${dayLabel(batch.expiryDate)})`,
          diff: {
            [item.name]: {
              before,
              after: Math.round((before - quantity) * 1000) / 1000,
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const batch = await this.findBatch(
          ctx.organizationId,
          asString(args.batchId, 'batchId', 100),
        );
        const reason = asOptionalString(args.reason, 'reason', 40) ?? 'expired';
        return this.transactions.create(
          {
            itemId: batch.inventoryItemId,
            type: TransactionTypeDto.WASTAGE,
            quantity: Number(batch.quantity),
            note: `${reason}: batch ${batch.batchNumber}`,
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
