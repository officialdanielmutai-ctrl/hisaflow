import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import { CreditService } from '../../finance/credit.service';
import { TieredPricingService } from '../../tiered-pricing/tiered-pricing.service';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asLimit,
  asOptionalDate,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

const WHOLESALER = ['WHOLESALER'];
const STAFF_ROLES = [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF];
const MANAGER_ROLES = [AppRole.OWNER, AppRole.MANAGER];

interface PackagingUnit {
  id: string;
  name: string;
  quantityPerUnit: number;
  sellingPrice: unknown;
}

function kes(amount: number): string {
  return `KES ${new Intl.NumberFormat('en-KE').format(amount)}`;
}

/**
 * WHOLESALER tool set (overhaul Duty 2, Phase E — remaining verticals).
 *
 * Same contract as the other verticals: `read` tools run immediately, `write`
 * tools only build a proposal, and the executor commits through the same
 * transactions / credits / tiered-pricing services the manual UI uses.
 *
 * Generic purchase and wastage live in the foundation tool set and are widened
 * to wholesalers there; this provider adds the client/credit and bulk flows.
 */
@Injectable()
export class WholesaleAssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly credits: CreditService,
    private readonly tieredPricing: TieredPricingService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // reads
      this.listDebtors(),
      this.listPackagingUnits(),
      this.getTopSellers(),
      // writes
      this.recordWholesaleSale(),
      this.recordBulkSale(),
      this.recordCreditPayment(),
      this.createTieredPrice(),
    ];
  }

  // ── scoped lookups ──────────────────────────────────────────────────────
  private async findItem(organizationId: string, id: string, withPackaging = false) {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        unit: true,
        quantity: true,
        sellingPrice: true,
        ...(withPackaging
          ? {
              packaging: {
                select: {
                  id: true,
                  name: true,
                  quantityPerUnit: true,
                  sellingPrice: true,
                },
              },
            }
          : {}),
      },
    });
    if (!item) {
      throw new BadRequestException(
        'No matching item in this organization.',
      );
    }
    return item;
  }

  private async findCredit(organizationId: string, id: string) {
    const credit = await this.prisma.db.creditRecord.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        clientName: true,
        amountTotal: true,
        amountPaid: true,
        status: true,
      },
    });
    if (!credit) {
      throw new BadRequestException(
        'No matching credit record in this organization.',
      );
    }
    return credit;
  }

  private resolvePackaging(
    item: { packaging?: PackagingUnit[] },
    packagingUnitId: string | undefined,
  ): PackagingUnit {
    const units = item.packaging ?? [];
    if (units.length === 0) {
      throw new BadRequestException(
        'This item has no packaging unit defined; record a plain sale instead.',
      );
    }
    if (packagingUnitId) {
      const match = units.find((unit) => unit.id === packagingUnitId);
      if (!match) {
        throw new BadRequestException(
          'No matching packaging unit for this item.',
        );
      }
      return match;
    }
    if (units.length === 1) return units[0];
    throw new BadRequestException(
      `This item has several packaging units (${units
        .map((unit) => `${unit.name} x${unit.quantityPerUnit}`)
        .join(', ')}). Specify "packagingUnitId".`,
    );
  }

  // ── read: debtors ───────────────────────────────────────────────────────
  private listDebtors(): ToolDefinition {
    return {
      name: 'list_debtors',
      description:
        'List clients with an unpaid or partially paid credit balance. Read-only. Use this to resolve a credit ID before recording a payment.',
      kind: 'read',
      riskLevel: 'low',
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const limit = asLimit(args.limit, 20);
        const records = await this.prisma.db.creditRecord.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['UNPAID', 'PARTIAL'] },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            clientName: true,
            amountTotal: true,
            amountPaid: true,
            status: true,
            dueDate: true,
            transaction: {
              select: { item: { select: { name: true } } },
            },
          },
        });
        return records
          .map((record) => ({
            creditId: record.id,
            clientName: record.clientName,
            item: record.transaction?.item?.name ?? null,
            amountTotal: Number(record.amountTotal),
            amountPaid: Number(record.amountPaid),
            balance: Math.round(
              (Number(record.amountTotal) - Number(record.amountPaid)) * 100,
            ) / 100,
            status: record.status,
            dueDate: record.dueDate,
          }))
          .filter((row) => row.balance > 0);
      },
    };
  }

  // ── read: packaging units ───────────────────────────────────────────────
  private listPackagingUnits(): ToolDefinition {
    return {
      name: 'list_packaging_units',
      description:
        'List the packaging units (carton, crate, box) defined for an item, with how many base units each holds. Read-only. Use this before a bulk sale.',
      kind: 'read',
      riskLevel: 'low',
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: { itemId: { type: 'string' } },
        required: ['itemId'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = (await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
          true,
        )) as { id: string; name: string; packaging?: PackagingUnit[] };
        return {
          itemId: item.id,
          item: item.name,
          packagingUnits: (item.packaging ?? []).map((unit) => ({
            id: unit.id,
            name: unit.name,
            quantityPerUnit: unit.quantityPerUnit,
            sellingPrice:
              unit.sellingPrice == null ? null : Number(unit.sellingPrice),
          })),
        };
      },
    };
  }

  // ── read: top sellers ───────────────────────────────────────────────────
  private getTopSellers(): ToolDefinition {
    return {
      name: 'get_top_sellers',
      description:
        'List the best-selling items over the last N days (default 7). Read-only.',
      kind: 'read',
      riskLevel: 'low',
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number' },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const days = args.days === undefined ? 7 : asPositiveNumber(args.days, 'days');
        const limit = asLimit(args.limit, 5);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const grouped = await this.prisma.db.inventoryTransaction.groupBy({
          by: ['itemId'],
          where: {
            organizationId: ctx.organizationId,
            type: 'SALE',
            createdAt: { gte: since },
          },
          _sum: { quantityChange: true },
          orderBy: { _sum: { quantityChange: 'asc' } },
          take: limit,
        });
        const items = await this.prisma.db.inventoryItem.findMany({
          where: {
            organizationId: ctx.organizationId,
            id: { in: grouped.map((row) => row.itemId) },
          },
          select: { id: true, name: true, unit: true },
        });
        const byId = new Map(items.map((item) => [item.id, item]));
        return {
          days,
          topSellers: grouped.map((row) => ({
            itemId: row.itemId,
            name: byId.get(row.itemId)?.name ?? 'Unknown',
            unit: byId.get(row.itemId)?.unit ?? '',
            totalSold: Math.abs(Number(row._sum.quantityChange ?? 0)),
          })),
        };
      },
    };
  }

  // ── write: wholesale sale (client / credit aware) ───────────────────────
  private recordWholesaleSale(): ToolDefinition {
    return {
      name: 'record_wholesale_sale',
      description:
        'Sell stock to a client, optionally on credit. Requires approval. Use search_inventory for the item ID. For a multi-carton sale use record_bulk_sale.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          quantity: { type: 'number' },
          clientName: { type: 'string' },
          isCredit: { type: 'boolean' },
          dueDate: { type: 'string', description: 'ISO date.' },
          creditNotes: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.buildSale(args, ctx.organizationId);
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const sale = this.normaliseSale(args);
        return this.transactions.create(
          {
            itemId: asString(args.itemId, 'itemId', 100),
            type: TransactionTypeDto.SALE,
            quantity: sale.quantity,
            note: sale.note,
            clientName: sale.clientName,
            isCredit: sale.isCredit,
            dueDate: sale.dueDate,
            creditNotes: sale.creditNotes,
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

  // ── write: bulk (carton) sale ───────────────────────────────────────────
  private recordBulkSale(): ToolDefinition {
    return {
      name: 'record_bulk_sale',
      description:
        'Sell whole cartons/crates to a client, converting to base units automatically. Requires approval. Use list_packaging_units to choose the packaging unit.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          cartons: { type: 'number' },
          clientName: { type: 'string' },
          packagingUnitId: { type: 'string' },
          isCredit: { type: 'boolean' },
          dueDate: { type: 'string', description: 'ISO date.' },
          creditNotes: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['itemId', 'cartons', 'clientName'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const cartons = asPositiveNumber(args.cartons, 'cartons');
        const item = (await this.findItem(
          ctx.organizationId,
          itemId,
          true,
        )) as {
          id: string;
          name: string;
          unit: string;
          quantity: unknown;
          packaging?: PackagingUnit[];
        };
        const packaging = this.resolvePackaging(
          item,
          asOptionalString(args.packagingUnitId, 'packagingUnitId', 100),
        );
        const quantity = cartons * packaging.quantityPerUnit;
        const clientName = asString(args.clientName, 'clientName', 200);
        const before = Number(item.quantity);
        if (before < quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${item.name}. Available: ${before} ${item.unit}, requested: ${quantity}.`,
          );
        }
        const credit = this.normaliseCredit(args, clientName);
        return {
          args: {
            itemId: item.id,
            cartons,
            clientName,
            packagingUnitId: packaging.id,
            isCredit: credit.isCredit,
            dueDate: credit.dueDate,
            creditNotes: credit.creditNotes,
            note: asOptionalString(args.note, 'note', 300),
          },
          summary: `Sell ${cartons} ${packaging.name} (${quantity} ${item.unit}) of ${
            item.name
          } to ${clientName}${credit.isCredit ? ' on credit' : ''}`,
          diff: {
            item: item.name,
            quantity: { before, after: before - quantity },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const cartons = asPositiveNumber(args.cartons, 'cartons');
        const clientName = asString(args.clientName, 'clientName', 200);
        const item = (await this.findItem(ctx.organizationId, itemId, true)) as {
          packaging?: PackagingUnit[];
        };
        const packaging = this.resolvePackaging(
          item,
          asOptionalString(args.packagingUnitId, 'packagingUnitId', 100),
        );
        const credit = this.normaliseCredit(args, clientName);
        return this.transactions.create(
          {
            itemId,
            type: TransactionTypeDto.SALE,
            quantity: cartons * packaging.quantityPerUnit,
            note: asOptionalString(args.note, 'note', 300),
            clientName,
            isCredit: credit.isCredit,
            dueDate: credit.dueDate,
            creditNotes: credit.creditNotes,
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

  private normaliseCredit(
    args: Record<string, unknown>,
    clientName: string,
  ): { isCredit: boolean; dueDate?: string; creditNotes?: string } {
    const isCredit = args.isCredit === true;
    if (isCredit && !clientName.trim()) {
      throw new BadRequestException(
        '"clientName" is required for a credit sale.',
      );
    }
    return {
      isCredit,
      dueDate: isCredit
        ? asOptionalDate(args.dueDate, 'dueDate')
        : undefined,
      creditNotes: isCredit
        ? asOptionalString(args.creditNotes, 'creditNotes', 300)
        : undefined,
    };
  }

  private normaliseSale(args: Record<string, unknown>) {
    return {
      quantity: asPositiveNumber(args.quantity, 'quantity'),
      clientName: asOptionalString(args.clientName, 'clientName', 200),
      note: asOptionalString(args.note, 'note', 300),
      ...this.normaliseCredit(
        args,
        asOptionalString(args.clientName, 'clientName', 200) ?? '',
      ),
    };
  }

  private async buildSale(args: Record<string, unknown>, organizationId: string) {
    const itemId = asString(args.itemId, 'itemId', 100);
    const item = await this.findItem(organizationId, itemId);
    const sale = this.normaliseSale(args);
    const before = Number(item.quantity);
    if (before < sale.quantity) {
      throw new BadRequestException(
        `Insufficient stock for ${item.name}. Available: ${before} ${item.unit}.`,
      );
    }
    const client = sale.clientName ? ` to ${sale.clientName}` : '';
    return {
      args: {
        itemId: item.id,
        quantity: sale.quantity,
        clientName: sale.clientName,
        isCredit: sale.isCredit,
        dueDate: sale.dueDate,
        creditNotes: sale.creditNotes,
        note: sale.note,
      },
      summary: `Sell ${sale.quantity} ${item.unit} of ${item.name}${client}${
        sale.isCredit ? ' on credit' : ''
      }`,
      diff: {
        item: item.name,
        quantity: { before, after: before - sale.quantity },
      },
      riskLevel: 'medium' as const,
    };
  }

  // ── write: record a credit payment ──────────────────────────────────────
  private recordCreditPayment(): ToolDefinition {
    return {
      name: 'record_credit_payment',
      description:
        'Record a payment against a client\u2019s outstanding credit. Requires approval. Use list_debtors to find the credit ID and balance.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: {
          creditId: { type: 'string' },
          amount: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['creditId', 'amount'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const credit = await this.findCredit(
          ctx.organizationId,
          asString(args.creditId, 'creditId', 100),
        );
        const amount = asPositiveNumber(args.amount, 'amount');
        const before =
          Math.round(
            (Number(credit.amountTotal) - Number(credit.amountPaid)) * 100,
          ) / 100;
        return {
          args: {
            creditId: credit.id,
            amount,
            notes: asOptionalString(args.notes, 'notes', 300),
          },
          summary: `Record ${kes(amount)} payment from ${credit.clientName}`,
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
        return this.credits.recordPayment(
          asString(args.creditId, 'creditId', 100),
          ctx.organizationId,
          {
            amount: asPositiveNumber(args.amount, 'amount'),
            notes: asOptionalString(args.notes, 'notes', 300),
          },
        );
      },
    };
  }

  // ── write: tiered pricing ───────────────────────────────────────────────
  private createTieredPrice(): ToolDefinition {
    return {
      name: 'create_tiered_price',
      description:
        'Set the wholesale price tiers for an item (replaces existing tiers). Requires approval. Use search_inventory for the item ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: WHOLESALER,
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                minQuantity: { type: 'number' },
                pricePerUnit: { type: 'number' },
                label: { type: 'string' },
              },
              required: ['minQuantity', 'pricePerUnit'],
            },
          },
        },
        required: ['itemId', 'tiers'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const item = await this.findItem(
          ctx.organizationId,
          asString(args.itemId, 'itemId', 100),
        );
        const tiers = this.normaliseTiers(args.tiers);
        return {
          args: { itemId: item.id, tiers },
          summary: `Set ${tiers.length} wholesale price tier${
            tiers.length === 1 ? '' : 's'
          } for ${item.name}`,
          diff: { before: null, after: { item: item.name, tiers } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const tiers = this.normaliseTiers(args.tiers);
        return this.tieredPricing.upsertRules(
          ctx.organizationId,
          itemId,
          tiers.map((tier) => ({ ...tier, inventoryItemId: itemId })),
        );
      },
    };
  }

  private normaliseTiers(
    value: unknown,
  ): Array<{ minQuantity: number; pricePerUnit: number; label?: string }> {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('"tiers" must be a non-empty array.');
    }
    return value.map((entry, index) => {
      const tier = asRecord(entry);
      return {
        minQuantity: asPositiveNumber(
          tier.minQuantity,
          `tiers[${index}].minQuantity`,
        ),
        pricePerUnit: asPositiveNumber(
          tier.pricePerUnit,
          `tiers[${index}].pricePerUnit`,
        ),
        label: asOptionalString(tier.label, `tiers[${index}].label`, 100),
      };
    });
  }
}
