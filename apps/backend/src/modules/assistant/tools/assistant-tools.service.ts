import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { NotesService } from '../../notes/notes.service';
import { NoteImportance } from '../../notes/dto/create-note.dto';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionTypeDto } from '../../transactions/dto/create-transaction.dto';
import { FinanceService } from '../../finance/finance.service';
import { FinanceSearchService } from '../../finance/finance-search.service';
import { BusinessTransactionsService } from '../../finance/business-transactions.service';
import { AlertsService } from '../../alerts/alerts.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { AssistantCommsService } from '../comms/assistant-comms.service';
import { AssistantUnsupportedService } from '../unsupported/assistant-unsupported.service';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asEnum,
  asLimit,
  asOptionalDate,
  asOptionalEnum,
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

const DAY_MS = 24 * 60 * 60 * 1000;

const TRANSACTION_TYPES = [
  'SALE',
  'PURCHASE',
  'WASTAGE',
  'ADJUSTMENT',
  'RETURN',
  'TRANSFER',
] as const;

const NOTE_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] as const;

const EXPENSE_CATEGORIES = [
  'RENT',
  'SALARY',
  'UTILITIES',
  'LOAN',
  'SUPPLIES',
  'TRANSPORT',
  'MARKETING',
  'TAX',
  'SERVICES',
  'MAINTENANCE',
  'WASTAGE',
  'OTHER_EXPENSE',
] as const;

const INCOME_CATEGORIES = [
  'SERVICE_FEE',
  'REFUND',
  'GRANT',
  'OTHER_INCOME',
] as const;

const RECURRENCE_RULES = ['MONTHLY', 'WEEKLY', 'YEARLY'] as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function appliedTierPrice(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as Record<string, unknown>).appliedTierPrice;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
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
 * Shared foundation tool set offered to every business type: inventory,
 * reporting and catalogue advice, notes, business ledger, alerts and comms.
 * Writes never mutate here — they build a proposal; only the executor commits
 * through the same domain service the manual UI uses.
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
    private readonly finance: FinanceService,
    private readonly financeSearch: FinanceSearchService,
    private readonly businessTransactions: BusinessTransactionsService,
    private readonly alerts: AlertsService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // Reporting and advice first: these are the questions owners ask most,
      // and they also drive the suggestion chips on the assistant screen.
      this.getSalesReport(),
      this.analyseCatalogue(),
      this.getCreditSummary(),
      this.getActiveAlerts(),
      this.getLowStock(),
      this.searchInventory(),
      this.listInventory(),
      this.getPurchaseReport(),
      this.getExpenseReport(),
      this.getRecentTransactions(),
      this.listNotes(),
      this.getTaxSummary(),
      this.listTeamMembers(),
      this.getFinancialBreakdown(),
      this.searchBusinessFinances(),
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
      this.adjustStock(),
      this.archiveInventoryItem(),
      this.businessTransactionTool({
        name: 'record_expense',
        description:
          'Record a business expense that is not stock (rent, salary, utilities, transport, marketing, repairs and similar). Requires approval. Use get_expense_report first if the user is asking rather than telling you to record it.',
        type: 'EXPENSE',
        categories: EXPENSE_CATEGORIES,
      }),
      this.businessTransactionTool({
        name: 'record_income',
        description:
          'Record non-stock business income (a service fee, grant, refund or other income). Requires approval. Inventory sales belong in record_sale instead.',
        type: 'INCOME',
        categories: INCOME_CATEGORIES,
      }),
      this.resolveAlert(),
      this.sendEmail(),
      this.sendSms(),
      this.logUnsupportedIntent(),
    ];
  }

  // ── shared period resolver ──────────────────────────────────────────────
  private resolvePeriod(
    args: Record<string, unknown>,
    defaultDays: number,
  ): { start: Date; end: Date; days: number } {
    const days =
      args.days === undefined || args.days === null
        ? defaultDays
        : asPositiveNumber(args.days, 'days');
    if (days > 365) {
      throw new BadRequestException('"days" must be 365 or fewer.');
    }
    const from = asOptionalDate(args.from, 'from');
    const to = asOptionalDate(args.to, 'to');
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - days * DAY_MS);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('"from" must be before "to".');
    }
    return { start, end, days: Math.max(1, Math.round(days)) };
  }

  /**
   * Aggregate recorded stock sales once, so the current and previous periods
   * are measured exactly the same way. The model only ever sees the numbers
   * returned here; it never estimates them.
   */
  private async salesSnapshot(
    organizationId: string,
    start: Date,
    end: Date,
  ) {
    const sales = await this.prisma.db.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: 'SALE',
        createdAt: { gte: start, lte: end },
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            unit: true,
            category: true,
            costPrice: true,
            sellingPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    const items = new Map<
      string,
      {
        itemId: string;
        name: string;
        unit: string;
        units: number;
        sales: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();
    const categories = new Map<
      string,
      { category: string; units: number; sales: number; revenue: number; profit: number }
    >();
    const days = new Map<string, { date: string; sales: number; revenue: number }>();
    let revenue = 0;
    let costOfSales = 0;
    let totalUnits = 0;
    let creditSales = 0;
    let creditRevenue = 0;

    for (const sale of sales) {
      const quantity = Math.abs(Number(sale.quantityChange));
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const unitPrice =
        appliedTierPrice(sale.metadata) ?? Number(sale.item?.sellingPrice ?? 0);
      const unitCost = Number(sale.item?.costPrice ?? 0);
      const saleRevenue = unitPrice * quantity;
      const saleCost = unitCost * quantity;
      const category = sale.item?.category?.trim() || 'Uncategorised';
      const dateKey = sale.createdAt.toISOString().slice(0, 10);

      revenue += saleRevenue;
      costOfSales += saleCost;
      totalUnits += quantity;
      if (sale.source === 'credit') {
        creditSales += 1;
        creditRevenue += saleRevenue;
      }

      const key = sale.itemId;
      const existing = items.get(key) ?? {
        itemId: key,
        name: sale.item?.name ?? 'Unknown item',
        unit: sale.item?.unit ?? '',
        units: 0,
        sales: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      existing.units += quantity;
      existing.sales += 1;
      existing.revenue += saleRevenue;
      existing.cost += saleCost;
      existing.profit = existing.revenue - existing.cost;
      items.set(key, existing);

      const categoryRow = categories.get(category) ?? {
        category,
        units: 0,
        sales: 0,
        revenue: 0,
        profit: 0,
      };
      categoryRow.units += quantity;
      categoryRow.sales += 1;
      categoryRow.revenue += saleRevenue;
      categoryRow.profit += saleRevenue - saleCost;
      categories.set(category, categoryRow);

      const day = days.get(dateKey) ?? { date: dateKey, sales: 0, revenue: 0 };
      day.sales += 1;
      day.revenue += saleRevenue;
      days.set(dateKey, day);
    }

    return {
      salesCount: sales.length,
      totalUnits,
      revenue,
      costOfSales,
      grossProfit: revenue - costOfSales,
      creditSales,
      creditRevenue,
      items,
      categories,
      days,
    };
  }

  // ── read: sales report ──────────────────────────────────────────────────
  private getSalesReport(): ToolDefinition {
    return {
      name: 'get_sales_report',
      description:
        'Report stock/item sales for a period: number of sales, units, revenue, cost of sales, gross profit, credit sales and the best-selling items. Read-only. Use this for questions like “how were sales this week?”, “what sold best yesterday?” or “what is my average sale?”. This covers sales recorded against inventory (including bar/tuck-shop sales); use get_financial_breakdown for room, plan or school-fee revenue. Never invent a sales figure.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Lookback window in days (default 7, maximum 365).',
          },
          from: { type: 'string', description: 'Optional ISO start date.' },
          to: { type: 'string', description: 'Optional ISO end date.' },
          limit: {
            type: 'number',
            description: 'Maximum top items to return (default 5).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const period = this.resolvePeriod(args, 7);
        const limit = asLimit(args.limit, 5);
        const windowMs = period.end.getTime() - period.start.getTime();
        const previousEnd = new Date(period.start.getTime() - 1);
        const previousStart = new Date(previousEnd.getTime() - windowMs);

        const [current, previous, credits] = await Promise.all([
          this.salesSnapshot(ctx.organizationId, period.start, period.end),
          this.salesSnapshot(ctx.organizationId, previousStart, previousEnd),
          this.prisma.db.creditRecord.findMany({
            where: {
              organizationId: ctx.organizationId,
              status: { in: ['UNPAID', 'PARTIAL'] },
            },
            select: { amountTotal: true, amountPaid: true },
          }),
        ]);

        const creditOutstanding = credits.reduce(
          (sum, credit) =>
            sum + (Number(credit.amountTotal) - Number(credit.amountPaid)),
          0,
        );
        const changePct =
          previous.revenue > 0
            ? ((current.revenue - previous.revenue) / previous.revenue) * 100
            : current.revenue > 0
              ? 100
              : 0;

        return {
          period: {
            from: period.start.toISOString(),
            to: period.end.toISOString(),
            days: period.days,
          },
          totalSales: current.salesCount,
          totalUnits: round2(current.totalUnits),
          revenue: round2(current.revenue),
          costOfSales: round2(current.costOfSales),
          grossProfit: round2(current.grossProfit),
          grossMarginPct:
            current.revenue > 0
              ? round2((current.grossProfit / current.revenue) * 100)
              : 0,
          averageSaleValue:
            current.salesCount > 0
              ? round2(current.revenue / current.salesCount)
              : 0,
          creditSales: {
            count: current.creditSales,
            revenue: round2(current.creditRevenue),
            outstanding: round2(Math.max(0, creditOutstanding)),
          },
          comparedWithPreviousPeriod: {
            from: previousStart.toISOString(),
            to: previousEnd.toISOString(),
            revenue: round2(previous.revenue),
            units: round2(previous.totalUnits),
            sales: previous.salesCount,
            revenueChangePct: round2(changePct),
            direction:
              changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat',
          },
          topItems: Array.from(current.items.values())
            .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
            .slice(0, limit)
            .map((item) => ({
              ...item,
              units: round2(item.units),
              revenue: round2(item.revenue),
              cost: round2(item.cost),
              profit: round2(item.profit),
            })),
          byCategory: Array.from(current.categories.values())
            .sort((a, b) => b.revenue - a.revenue)
            .map((category) => ({
              ...category,
              units: round2(category.units),
              revenue: round2(category.revenue),
              profit: round2(category.profit),
            })),
          byDay: Array.from(current.days.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((day) => ({ ...day, revenue: round2(day.revenue) })),
        };
      },
    };
  }

  // ── read: purchases / restocking report ─────────────────────────────────
  private getPurchaseReport(): ToolDefinition {
    return {
      name: 'get_purchase_report',
      description:
        'Report stock purchases and restocking for a period: number of purchase entries, units received, cost at the item cost price and the items bought most. Read-only. Use this for “how much did I spend on stock?”, “what did I restock?” or before advising on restocking. For rent, salaries and other running costs use get_expense_report.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Lookback window in days (default 30, maximum 365).',
          },
          from: { type: 'string', description: 'Optional ISO start date.' },
          to: { type: 'string', description: 'Optional ISO end date.' },
          limit: {
            type: 'number',
            description: 'Maximum top items to return (default 5).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const period = this.resolvePeriod(args, 30);
        const limit = asLimit(args.limit, 5);

        const purchases = await this.prisma.db.inventoryTransaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            type: 'PURCHASE',
            createdAt: { gte: period.start, lte: period.end },
          },
          include: {
            item: {
              select: {
                id: true,
                name: true,
                unit: true,
                category: true,
                costPrice: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 5000,
        });

        const items = new Map<
          string,
          {
            itemId: string;
            name: string;
            unit: string;
            units: number;
            purchases: number;
            cost: number;
          }
        >();
        let totalUnits = 0;
        let totalCost = 0;
        for (const purchase of purchases) {
          const quantity = Math.abs(Number(purchase.quantityChange));
          if (!Number.isFinite(quantity) || quantity <= 0) continue;
          const unitCost = Number(purchase.item?.costPrice ?? 0);
          const cost = unitCost * quantity;
          totalUnits += quantity;
          totalCost += cost;

          const existing = items.get(purchase.itemId) ?? {
            itemId: purchase.itemId,
            name: purchase.item?.name ?? 'Unknown item',
            unit: purchase.item?.unit ?? '',
            units: 0,
            purchases: 0,
            cost: 0,
          };
          existing.units += quantity;
          existing.purchases += 1;
          existing.cost += cost;
          items.set(purchase.itemId, existing);
        }

        return {
          period: {
            from: period.start.toISOString(),
            to: period.end.toISOString(),
            days: period.days,
          },
          totalPurchases: purchases.length,
          totalUnits: round2(totalUnits),
          totalCost: round2(totalCost),
          averagePurchaseCost:
            purchases.length > 0
              ? round2(totalCost / purchases.length)
              : 0,
          topItems: Array.from(items.values())
            .sort((a, b) => b.cost - a.cost || b.units - a.units)
            .slice(0, limit)
            .map((item) => ({
              ...item,
              units: round2(item.units),
              cost: round2(item.cost),
            })),
          note:
            'Costs use the item\u2019s current cost price; a purchase recorded without a cost price contributes zero cost.',
        };
      },
    };
  }

  // ── read: catalogue analysis + new-item suggestions ─────────────────────
  private analyseCatalogue(): ToolDefinition {
    return {
      name: 'analyse_catalogue',
      description:
        'Analyse the product catalogue and sales history, then return evidence-based opportunities: fast movers, slow/dead stock, low stock, margin risks, packaging gaps, categories with too few products, and suggested new items. Read-only. Use this before advising what to stock, what to drop, what to price differently or which new products to consider. Suggestions are ideas, not existing records; never claim a suggested item is already in the catalogue.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Sales window for demand analysis (default 30, maximum 365).',
          },
          limit: {
            type: 'number',
            description: 'Maximum rows per list (default 5).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const days =
          args.days === undefined || args.days === null
            ? 30
            : asPositiveNumber(args.days, 'days');
        if (days > 365) {
          throw new BadRequestException('"days" must be 365 or fewer.');
        }
        const limit = asLimit(args.limit, 5);
        const recentStart = new Date(Date.now() - days * DAY_MS);
        const historyStart = new Date(Date.now() - 90 * DAY_MS);

        const items = await this.prisma.db.inventoryItem.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          orderBy: { name: 'asc' },
          take: 500,
          select: {
            id: true,
            name: true,
            unit: true,
            category: true,
            quantity: true,
            reorderThreshold: true,
            costPrice: true,
            sellingPrice: true,
            packaging: { select: { id: true, name: true, quantityPerUnit: true } },
          },
        });
        const history = await this.prisma.db.inventoryTransaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            type: 'SALE',
            createdAt: { gte: historyStart },
          },
          select: {
            itemId: true,
            quantityChange: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        const itemById = new Map(items.map((item) => [item.id, item]));
        const stats = new Map<
          string,
          { recentUnits: number; historyUnits: number; revenue: number; lastSoldAt: Date | null }
        >();
        for (const sale of history) {
          const quantity = Math.abs(Number(sale.quantityChange));
          if (!Number.isFinite(quantity) || quantity <= 0) continue;
          const item = itemById.get(sale.itemId);
          if (!item) continue;
          const current = stats.get(item.id) ?? {
            recentUnits: 0,
            historyUnits: 0,
            revenue: 0,
            lastSoldAt: null,
          };
          current.historyUnits += quantity;
          if (sale.createdAt >= recentStart) {
            current.recentUnits += quantity;
            current.revenue +=
              (appliedTierPrice(sale.metadata) ??
                Number(item.sellingPrice ?? 0)) * quantity;
          }
          if (!current.lastSoldAt || sale.createdAt > current.lastSoldAt) {
            current.lastSoldAt = sale.createdAt;
          }
          stats.set(item.id, current);
        }

        const categoryMap = new Map<
          string,
          {
            category: string;
            skuCount: number;
            unitsSold: number;
            revenue: number;
            stockValue: number;
          }
        >();
        const catalogue = items.map((item) => {
          const stat = stats.get(item.id);
          const quantity = Number(item.quantity);
          const costPrice = Number(item.costPrice ?? 0);
          const sellingPrice = Number(item.sellingPrice ?? 0);
          const marginPct =
            sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : null;
          const category = item.category?.trim() || 'Uncategorised';
          const categoryStats = categoryMap.get(category) ?? {
            category,
            skuCount: 0,
            unitsSold: 0,
            revenue: 0,
            stockValue: 0,
          };
          categoryStats.skuCount += 1;
          categoryStats.unitsSold += stat?.recentUnits ?? 0;
          categoryStats.revenue += stat?.revenue ?? 0;
          categoryStats.stockValue += quantity * costPrice;
          categoryMap.set(category, categoryStats);
          return {
            id: item.id,
            name: item.name,
            unit: item.unit,
            category,
            quantity: round2(quantity),
            reorderThreshold:
              item.reorderThreshold == null ? null : Number(item.reorderThreshold),
            costPrice: item.costPrice == null ? null : Number(item.costPrice),
            sellingPrice:
              item.sellingPrice == null ? null : Number(item.sellingPrice),
            marginPct: marginPct == null ? null : round2(marginPct),
            unitsSold: round2(stat?.recentUnits ?? 0),
            revenue: round2(stat?.revenue ?? 0),
            lastSoldAt: stat?.lastSoldAt?.toISOString() ?? null,
            packagingUnits: item.packaging.length,
          };
        });

        const topSellers = [...catalogue]
          .filter((item) => item.unitsSold > 0)
          .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
          .slice(0, limit);
        const lowStock = catalogue
          .filter(
            (item) =>
              item.reorderThreshold !== null &&
              item.reorderThreshold > 0 &&
              item.quantity <= item.reorderThreshold,
          )
          .slice(0, limit);
        const outOfStock = catalogue.filter((item) => item.quantity <= 0).slice(0, limit);
        const slowMovers = catalogue
          .filter((item) => item.quantity > 0 && item.unitsSold === 0)
          .sort(
            (a, b) =>
              b.quantity * (b.costPrice ?? 0) - a.quantity * (a.costPrice ?? 0),
          )
          .slice(0, limit);
        const marginRisks = catalogue
          .filter(
            (item) =>
              item.sellingPrice !== null &&
              item.costPrice !== null &&
              (item.sellingPrice <= item.costPrice ||
                (item.marginPct !== null && item.marginPct < 10)),
          )
          .slice(0, limit);
        const packagingGaps = topSellers
          .filter((item) => item.packagingUnits === 0)
          .slice(0, limit);
        const categories = Array.from(categoryMap.values())
          .map((category) => ({
            ...category,
            unitsSold: round2(category.unitsSold),
            revenue: round2(category.revenue),
            stockValue: round2(category.stockValue),
          }))
          .sort((a, b) => b.revenue - a.revenue);
        const categoryGaps = categories
          .filter((category) => category.revenue > 0 && category.skuCount <= 1)
          .slice(0, limit);

        const suggestions: Array<{
          type: string;
          title: string;
          reason: string;
          itemId?: string;
          category?: string;
        }> = [];
        for (const item of topSellers) {
          if (lowStock.some((low) => low.id === item.id)) {
            suggestions.push({
              type: 'restock',
              title: `Restock ${item.name}`,
              reason: `${item.unitsSold} ${item.unit} sold in the last ${days} days and only ${item.quantity} remain.`,
              itemId: item.id,
            });
          }
          if (item.packagingUnits === 0) {
            suggestions.push({
              type: 'pack_size',
              title: `Add a bulk pack size for ${item.name}`,
              reason: `It is a fast mover (${item.unitsSold} ${item.unit} in ${days} days) but has no carton/pack unit, so bulk buyers must count base units.`,
              itemId: item.id,
            });
          }
        }
        for (const category of categoryGaps) {
          suggestions.push({
            type: 'category_gap',
            title: `Consider another product in ${category.category}`,
            reason: `${category.category} generated ${category.revenue.toFixed(0)} in sales from only ${category.skuCount} product(s); adding a complementary item could deepen the range.`,
            category: category.category,
          });
        }
        for (const item of marginRisks) {
          suggestions.push({
            type: 'price_review',
            title: `Review the price of ${item.name}`,
            reason: `Selling price is ${item.sellingPrice ?? 0} against a cost of ${item.costPrice ?? 0} (margin ${item.marginPct ?? 0}%).`,
            itemId: item.id,
          });
        }
        for (const item of slowMovers) {
          suggestions.push({
            type: 'dead_stock',
            title: `Review or clear ${item.name}`,
            reason: `${item.quantity} ${item.unit} in stock with no sales in the last ${days} days.`,
            itemId: item.id,
          });
        }

        return {
          generatedAt: new Date().toISOString(),
          salesWindowDays: days,
          catalogueSize: catalogue.length,
          stockValueAtCost: round2(
            catalogue.reduce(
              (sum, item) => sum + item.quantity * (item.costPrice ?? 0),
              0,
            ),
          ),
          categories,
          topSellers,
          lowStock,
          outOfStock,
          slowMovers,
          marginRisks,
          packagingGaps,
          categoryGaps,
          suggestedNewItems: categoryGaps.map((category) => ({
            category: category.category,
            reason: `Only ${category.skuCount} product(s) in a category with ${category.revenue.toFixed(0)} in sales; consider adding a complementary product.`,
          })),
          suggestions: suggestions.slice(0, Math.max(limit * 2, 10)),
          catalogue: catalogue.slice(0, 50),
          note:
            catalogue.length === 0
              ? 'This organization has no active catalogue items yet.'
              : undefined,
        };
      },
    };
  }

  // ── read: credit/debtors summary ────────────────────────────────────────
  private getCreditSummary(): ToolDefinition {
    return {
      name: 'get_credit_summary',
      description:
        'Summarise money owed by customers: total outstanding, total credit, total paid, ageing buckets and the largest/oldest debtors. Read-only. Use this for “who owes me?”, “how much is out on credit?” or “what is overdue?”. Never invent a debtor or balance.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          includePaid: { type: 'boolean' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const limit = asLimit(args.limit, 20, 100);
        const includePaid = args.includePaid === true;
        const records = await this.prisma.db.creditRecord.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(includePaid
              ? {}
              : { status: { in: ['UNPAID', 'PARTIAL'] } }),
          },
          include: {
            transaction: { select: { item: { select: { name: true } } } },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          take: 500,
        });

        const now = Date.now();
        const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
        let totalCredit = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;
        const debtors = records
          .map((record) => {
            const amountTotal = Number(record.amountTotal);
            const amountPaid = Number(record.amountPaid);
            const balance = Math.max(0, amountTotal - amountPaid);
            totalCredit += amountTotal;
            totalPaid += amountPaid;
            totalOutstanding += balance;
            const dueAt = record.dueDate ?? record.createdAt;
            const ageDays = Math.floor((now - dueAt.getTime()) / DAY_MS);
            if (ageDays <= 0) aging.current += balance;
            else if (ageDays <= 30) aging.days1to30 += balance;
            else if (ageDays <= 60) aging.days31to60 += balance;
            else if (ageDays <= 90) aging.days61to90 += balance;
            else aging.over90 += balance;
            return {
              id: record.id,
              clientName: record.clientName,
              item: record.transaction?.item?.name ?? null,
              amountTotal: round2(amountTotal),
              amountPaid: round2(amountPaid),
              balance: round2(balance),
              status: record.status,
              dueDate: record.dueDate?.toISOString() ?? null,
              ageDays,
            };
          })
          .filter((record) => record.balance > 0)
          .sort((a, b) => b.balance - a.balance || b.ageDays - a.ageDays);

        return {
          debtorCount: debtors.length,
          totalCredit: round2(totalCredit),
          totalPaid: round2(totalPaid),
          totalOutstanding: round2(totalOutstanding),
          aging: {
            current: round2(aging.current),
            days1to30: round2(aging.days1to30),
            days31to60: round2(aging.days31to60),
            days61to90: round2(aging.days61to90),
            over90: round2(aging.over90),
          },
          debtors: debtors.slice(0, limit),
        };
      },
    };
  }

  // ── read: expenses ──────────────────────────────────────────────────────
  private getExpenseReport(): ToolDefinition {
    return {
      name: 'get_expense_report',
      description:
        'Report recorded business expenses for a period, grouped by category, with the largest recent entries. Read-only. Use this for “what did I spend on rent/transport/marketing?” or “where are my expenses going?”. This covers BusinessTransaction expense entries; get_financial_breakdown adds cost of sales and other profit-and-loss context.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number' },
          from: { type: 'string', description: 'Optional ISO start date.' },
          to: { type: 'string', description: 'Optional ISO end date.' },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const period = this.resolvePeriod(args, 30);
        const limit = asLimit(args.limit, 10);
        const expenses = await this.prisma.db.businessTransaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            type: 'EXPENSE',
            date: { gte: period.start, lte: period.end },
          },
          orderBy: { date: 'desc' },
          take: 2000,
          select: {
            id: true,
            category: true,
            amount: true,
            description: true,
            date: true,
          },
        });
        const byCategory = new Map<string, { category: string; count: number; total: number }>();
        let total = 0;
        for (const expense of expenses) {
          const amount = Number(expense.amount);
          total += amount;
          const category = expense.category?.trim() || 'OTHER_EXPENSE';
          const row = byCategory.get(category) ?? { category, count: 0, total: 0 };
          row.count += 1;
          row.total += amount;
          byCategory.set(category, row);
        }
        return {
          period: {
            from: period.start.toISOString(),
            to: period.end.toISOString(),
            days: period.days,
          },
          totalExpenses: round2(total),
          byCategory: Array.from(byCategory.values())
            .map((row) => ({ ...row, total: round2(row.total) }))
            .sort((a, b) => b.total - a.total),
          recent: expenses.slice(0, limit).map((expense) => ({
            id: expense.id,
            category: expense.category,
            amount: round2(Number(expense.amount)),
            description: expense.description,
            date: expense.date.toISOString(),
          })),
        };
      },
    };
  }

  // ── read: active alerts ─────────────────────────────────────────────────
  private getActiveAlerts(): ToolDefinition {
    return {
      name: 'get_active_alerts',
      description:
        'List unresolved business alerts (low stock, dead stock, expiry risk, billing/payment due, tax issues, router drift, staff activity). Read-only. Use this for “what needs my attention?” before advising. Never invent an alert.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const limit = asLimit(args.limit, 20);
        const alerts = await this.prisma.db.alert.findMany({
          where: { organizationId: ctx.organizationId, resolvedAt: null },
          orderBy: [{ createdAt: 'desc' }],
          take: limit,
          select: {
            id: true,
            type: true,
            severity: true,
            title: true,
            description: true,
            createdAt: true,
            item: { select: { name: true } },
          },
        });
        return {
          count: alerts.length,
          alerts: alerts.map((alert) => ({
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            item: alert.item?.name ?? null,
            createdAt: alert.createdAt.toISOString(),
          })),
        };
      },
    };
  }

  // ── read: recent stock movements ───────────────────────────────────────
  private getRecentTransactions(): ToolDefinition {
    return {
      name: 'get_recent_transactions',
      description:
        'List recent stock movements (sales, purchases, wastage and adjustments) with the item, quantity before/after, client name, reason and time. Read-only. Use this for “what happened today?”, “show recent stock activity” or to check whether a movement was recorded. For totals across a period use get_sales_report or get_purchase_report.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Lookback window in days (default 7, maximum 365).',
          },
          type: {
            type: 'string',
            description: `Optional movement type: ${TRANSACTION_TYPES.join(', ')}.`,
          },
          itemId: { type: 'string', description: 'Optional inventory item ID.' },
          limit: {
            type: 'number',
            description: 'Maximum movements to return (default 20).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const days =
          args.days === undefined || args.days === null
            ? 7
            : asPositiveNumber(args.days, 'days');
        if (days > 365) {
          throw new BadRequestException('"days" must be 365 or fewer.');
        }
        const type = asOptionalEnum(args.type, 'type', TRANSACTION_TYPES);
        const itemId = asOptionalString(args.itemId, 'itemId', 100);
        const limit = asLimit(args.limit, 20, 100);
        const start = new Date(Date.now() - days * DAY_MS);

        const movements = await this.prisma.db.inventoryTransaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            createdAt: { gte: start },
            ...(type ? { type } : {}),
            ...(itemId ? { itemId } : {}),
          },
          include: {
            item: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { createdAt: 'desc' },
          // Aggregate the window, then show the newest `limit` entries. This
          // keeps the totals meaningful instead of counting only the preview.
          take: Math.max(limit * 10, 500),
        });

        const totalsByType: Record<
          string,
          { movements: number; units: number }
        > = {};
        for (const movement of movements) {
          const row = totalsByType[movement.type] ?? {
            movements: 0,
            units: 0,
          };
          row.movements += 1;
          row.units += Math.abs(Number(movement.quantityChange));
          totalsByType[movement.type] = row;
        }

        return {
          windowDays: days,
          count: movements.length,
          totalsByType: Object.fromEntries(
            Object.entries(totalsByType).map(([key, value]) => [
              key,
              { movements: value.movements, units: round2(value.units) },
            ]),
          ),
          movements: movements.slice(0, limit).map((movement) => ({
            id: movement.id,
            type: movement.type,
            item: movement.item?.name ?? 'Unknown item',
            unit: movement.item?.unit ?? '',
            quantityBefore: round2(Number(movement.quantityBefore)),
            quantityChange: round2(Number(movement.quantityChange)),
            quantityAfter: round2(Number(movement.quantityAfter)),
            clientName: movement.clientName,
            reason: movement.reason,
            source: movement.source,
            createdAt: movement.createdAt.toISOString(),
          })),
        };
      },
    };
  }

  // ── read: notes and reminders ──────────────────────────────────────────
  private listNotes(): ToolDefinition {
    return {
      name: 'list_notes',
      description:
        'List the team\u2019s notes, reminders and tasks, optionally filtered by status, importance or a search phrase. Read-only. Use this for “what is on my to-do list?”, “did we note the plumber?” or “what tasks are open?”. Restricted notes the user cannot see are excluded by the same rules as the Notes screen.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: `Optional status: ${NOTE_STATUSES.join(', ')}.`,
          },
          importance: {
            type: 'string',
            description: `Optional importance: ${IMPORTANCE.join(', ')}.`,
          },
          query: {
            type: 'string',
            description: 'Optional words to match in the title or body.',
          },
          limit: {
            type: 'number',
            description: 'Maximum notes to return (default 20).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const status = asOptionalEnum(args.status, 'status', NOTE_STATUSES);
        const importance = asOptionalEnum(
          args.importance,
          'importance',
          IMPORTANCE,
        );
        const query = (
          asOptionalString(args.query, 'query', 120) ?? ''
        ).toLowerCase();
        const limit = asLimit(args.limit, 20, 50);

        const visible = await this.notes.findAll(
          ctx.organizationId,
          ctx.userId,
          { status },
        );
        const filtered = visible.filter((note) => {
          if (importance && note.importance !== importance) return false;
          if (!query) return true;
          return (
            note.title.toLowerCase().includes(query) ||
            (note.content ?? '').toLowerCase().includes(query)
          );
        });

        return {
          count: filtered.length,
          notes: filtered.slice(0, limit).map((note) => ({
            id: note.id,
            title: note.title,
            content: note.content
              ? note.content.length > 500
                ? `${note.content.slice(0, 500)}\u2026`
                : note.content
              : null,
            importance: note.importance,
            status: note.status,
            dueDate: note.dueDate?.toISOString() ?? null,
            isPinned: note.isPinned,
            author: note.author?.name ?? null,
            checklist: {
              total: note.checklistItems.length,
              completed: note.checklistItems.filter((item) => item.isCompleted)
                .length,
            },
          })),
        };
      },
    };
  }

  // ── read: tax position ──────────────────────────────────────────────────
  private getTaxSummary(): ToolDefinition {
    return {
      name: 'get_tax_summary',
      description:
        'Summarise the organisation\u2019s KRA eTIMS position for a period: registration status, filed invoices, pending/signed invoices, failed filings, taxable value, tax and gross amounts, and recent filing errors. Read-only. Use this for “what is my tax position?”, “are my invoices filed?” or “is my KRA integration working?”. Do not give legal or accounting advice beyond explaining these figures.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Lookback window in days (default 30, maximum 365).',
          },
          from: { type: 'string', description: 'Optional ISO start date.' },
          to: { type: 'string', description: 'Optional ISO end date.' },
          limit: {
            type: 'number',
            description: 'Maximum recent failures to return (default 5).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const period = this.resolvePeriod(args, 30);
        const limit = asLimit(args.limit, 5);

        const [registration, records] = await Promise.all([
          this.prisma.db.taxRegistration.findUnique({
            where: { organizationId: ctx.organizationId },
            select: {
              status: true,
              integrationType: true,
              environment: true,
            },
          }),
          this.prisma.db.taxInvoiceRecord.findMany({
            where: {
              organizationId: ctx.organizationId,
              createdAt: { gte: period.start, lte: period.end },
            },
            select: {
              status: true,
              netAmount: true,
              taxAmount: true,
              grossAmount: true,
              lastError: true,
              createdAt: true,
              syncQueue: {
                select: { status: true, lastError: true, attempts: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        const summary = {
          filed: 0,
          pending: 0,
          failed: 0,
          taxableAmount: 0,
          taxAmount: 0,
          grossAmount: 0,
          pendingTaxAmount: 0,
        };
        for (const record of records) {
          if (record.status === 'SYNCED') {
            summary.filed += 1;
            summary.taxableAmount += Number(record.netAmount);
            summary.taxAmount += Number(record.taxAmount);
            summary.grossAmount += Number(record.grossAmount);
          } else if (record.status === 'FAILED') {
            summary.failed += 1;
          } else {
            summary.pending += 1;
            summary.pendingTaxAmount += Number(record.taxAmount);
          }
        }

        return {
          period: {
            from: period.start.toISOString(),
            to: period.end.toISOString(),
            days: period.days,
          },
          registration: registration
            ? {
                status: registration.status,
                integrationType: registration.integrationType,
                environment: registration.environment,
              }
            : null,
          summary: {
            filed: summary.filed,
            pending: summary.pending,
            failed: summary.failed,
            taxableAmount: round2(summary.taxableAmount),
            taxAmount: round2(summary.taxAmount),
            grossAmount: round2(summary.grossAmount),
            pendingTaxAmount: round2(summary.pendingTaxAmount),
          },
          recentFailures: records
            .filter((record) => record.status === 'FAILED')
            .slice(0, limit)
            .map((record) => ({
              createdAt: record.createdAt.toISOString(),
              error: record.syncQueue?.lastError ?? record.lastError,
              attempts: record.syncQueue?.attempts ?? 0,
            })),
          note:
            registration === null
              ? 'No KRA eTIMS registration has been recorded for this business yet.'
              : undefined,
        };
      },
    };
  }

  // ── read: team directory ───────────────────────────────────────────────
  private listTeamMembers(): ToolDefinition {
    return {
      name: 'list_team_members',
      description:
        'List the people who work in this organisation and their roles. Read-only. Use this for “who works here?”, “who is a manager?” or before drafting an internal task. Contact details are only offered to owners and managers.',
      kind: 'read',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum members to return (default 50).',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const limit = asLimit(args.limit, 50, 100);
        const members = await this.prisma.db.orgMembership.findMany({
          where: { organizationId: ctx.organizationId },
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: limit,
        });
        return {
          count: members.length,
          members: members.map((member) => ({
            userId: member.userId,
            name: member.user?.name ?? null,
            email: member.user?.email ?? null,
            phone: member.user?.phone ?? null,
            role: member.role,
            joinedAt: member.createdAt.toISOString(),
          })),
        };
      },
    };
  }

  // ── read: financial breakdown ──────────────────────────────────────────
  private getFinancialBreakdown(): ToolDefinition {
    return {
      name: 'get_financial_breakdown',
      description:
        "Summarise the organisation's finances for the last 30 days: revenue, cost of sales, gross and net profit, revenue broken down by this business's own sources (rooms, plans, classes or commodities), running costs by category and where money is leaking (wastage, unpaid invoices/fees/credit, expiring stock, repairs). Read-only. Use this for any revenue, profit, margin, loss or 'where is my money going' question; never invent figures.",
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async (_raw, ctx) => {
        const breakdown = await this.finance.getBreakdown(
          ctx.organizationId,
          'rolling30',
        );
        return {
          businessType: breakdown.businessType,
          period: 'last 30 days',
          revenue: breakdown.revenue,
          costOfSales: breakdown.cogs,
          grossProfit: breakdown.grossProfit,
          grossMarginPct: breakdown.grossMarginPct,
          otherIncome: breakdown.otherIncome,
          runningCosts: breakdown.operatingExpenses,
          maintenanceCosts: breakdown.maintenanceCosts,
          netProfit: breakdown.netProfit,
          netMarginPct: breakdown.netMarginPct,
          revenueBreakdown: breakdown.breakdowns.map((group) => ({
            title: group.title,
            rows: group.rows,
          })),
          expensesByCategory: breakdown.expensesByCategory,
          leaks: breakdown.leaks,
        };
      },
    };
  }

  // ── read: searchable financial attributes ───────────────────────────────
  private searchBusinessFinances(): ToolDefinition {
    return {
      name: 'search_business_finances',
      description:
        'Search the organisation\u2019s finances for a specific attribute: a room, service, subscription plan, class, commodity, expense category, client, leak (wastage, repairs, unpaid credit/invoices/fees, expiring stock) or ledger entry. Read-only. Use this to answer \u201chow much did X earn/cost?\u201d or \u201cwhat did we spend on X?\u201d; never invent figures.',
      kind: 'read',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for, e.g. a room name, plan, client or category. Empty returns the largest attributes.',
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const query = asOptionalString(args.query, 'query', 120) ?? '';
        const result = await this.financeSearch.search(
          ctx.organizationId,
          query,
          'rolling30',
        );
        return {
          period: 'last 30 days',
          totalMatched: result.totalMatched,
          results: result.results.map((attribute) => ({
            type: attribute.type,
            label: attribute.label,
            context: attribute.subtitle,
            amount: attribute.amount,
            sharePct: attribute.sharePct,
          })),
        };
      },
    };
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

  // ── write: correct a stock count ────────────────────────────────────────
  private adjustStock(): ToolDefinition {
    return {
      name: 'adjust_stock',
      description:
        'Set an existing item\u2019s stock to a counted quantity after a stock take, or correct a wrong balance. Requires approval and writes an ADJUSTMENT row in the stock ledger. For adding a delivery use record_purchase; for damage/expiry use record_wastage.',
      kind: 'write',
      riskLevel: 'medium',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          quantity: {
            type: 'number',
            description: 'The counted stock level (zero or more).',
          },
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const quantity = asOptionalNonNegative(args.quantity, 'quantity');
        if (quantity === undefined) {
          throw new BadRequestException('"quantity" is required.');
        }
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: {
            id: itemId,
            organizationId: ctx.organizationId,
            isActive: true,
          },
          select: { id: true, name: true, unit: true, quantity: true },
        });
        if (!item) {
          throw new BadRequestException(
            'No matching active item in this organization.',
          );
        }
        const before = Number(item.quantity);
        return {
          args: { itemId: item.id, quantity },
          summary: `Correct ${item.name} stock from ${before} to ${quantity} ${item.unit}`.trim(),
          diff: {
            item: item.name,
            quantity: { before, after: quantity },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.inventory.updateVariant(
          asString(args.itemId, 'itemId', 100),
          { quantity: asOptionalNonNegative(args.quantity, 'quantity') },
          ctx.organizationId,
          ctx.userId,
        );
      },
    };
  }

  // ── write: archive an item without destroying its history ────────────────
  private archiveInventoryItem(): ToolDefinition {
    return {
      name: 'archive_inventory_item',
      description:
        'Archive (soft-delete) an inventory item so it disappears from the active catalogue while its sales and ledger history are kept. Requires approval. Use this only when the user explicitly asks to remove, archive or stop selling an item.',
      kind: 'write',
      riskLevel: 'medium',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: { itemId: { type: 'string' } },
        required: ['itemId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const itemId = asString(args.itemId, 'itemId', 100);
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: {
            id: itemId,
            organizationId: ctx.organizationId,
            isActive: true,
          },
          select: { id: true, name: true, quantity: true, unit: true },
        });
        if (!item) {
          throw new BadRequestException(
            'No matching active item in this organization.',
          );
        }
        return {
          args: { itemId: item.id },
          summary: `Archive ${item.name} (${item.quantity} ${item.unit} left; history is kept)`,
          diff: {
            item: item.name,
            isActive: { before: true, after: false },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.inventory.deleteVariant(
          asString(args.itemId, 'itemId', 100),
          ctx.organizationId,
        );
      },
    };
  }

  // ── write: non-stock business expense / income ───────────────────────────
  private businessTransactionTool(config: {
    name: string;
    description: string;
    type: 'EXPENSE' | 'INCOME';
    categories: readonly string[];
  }): ToolDefinition {
    return {
      name: config.name,
      description: config.description,
      kind: 'write',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: `One of: ${config.categories.join(', ')}.`,
          },
          amount: { type: 'number', description: 'Amount in the business currency.' },
          description: { type: 'string' },
          date: { type: 'string', description: 'Optional ISO date; defaults to today.' },
          staffName: {
            type: 'string',
            description: 'For salary entries, the staff member paid.',
          },
          isRecurring: { type: 'boolean' },
          recurrenceRule: {
            type: 'string',
            description: `Optional recurrence: ${RECURRENCE_RULES.join(', ')}.`,
          },
        },
        required: ['category', 'amount'],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const args = asRecord(raw);
        const category = asEnum(
          args.category,
          'category',
          config.categories,
        );
        const amount = asPositiveNumber(args.amount, 'amount');
        const description = asOptionalString(
          args.description,
          'description',
          500,
        );
        const date = asOptionalDate(args.date, 'date');
        const staffName = asOptionalString(args.staffName, 'staffName', 100);
        const recurrenceRule = asOptionalEnum(
          args.recurrenceRule,
          'recurrenceRule',
          RECURRENCE_RULES,
        );
        const isRecurring =
          args.isRecurring === true || recurrenceRule !== undefined;
        const label = category.replace(/_/g, ' ').toLowerCase();
        const normalised = {
          type: config.type,
          category,
          amount,
          description,
          date,
          staffName,
          isRecurring,
          recurrenceRule,
        };
        return {
          args: normalised,
          summary: `Record ${config.type === 'EXPENSE' ? 'expense' : 'income'} of ${amount} under ${label}`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.businessTransactions.createBusinessTransaction(
          ctx.organizationId,
          {
            type: config.type,
            category: asEnum(args.category, 'category', config.categories),
            amount: asPositiveNumber(args.amount, 'amount'),
            description: asOptionalString(
              args.description,
              'description',
              500,
            ),
            staffName: asOptionalString(args.staffName, 'staffName', 100),
            date: asOptionalDate(args.date, 'date'),
            isRecurring: args.isRecurring === true,
            recurrenceRule: asOptionalEnum(
              args.recurrenceRule,
              'recurrenceRule',
              RECURRENCE_RULES,
            ),
          },
        );
      },
    };
  }

  // ── write: clear one alert or all unresolved alerts ─────────────────────
  private resolveAlert(): ToolDefinition {
    return {
      name: 'resolve_alert',
      description:
        'Mark one unresolved alert as resolved, or clear every unresolved alert for this business. Requires approval. Use this only when the user explicitly asks to dismiss, clear or resolve alerts; resolving an alert does not fix the underlying stock or billing problem.',
      kind: 'write',
      riskLevel: 'low',
      roles: [AppRole.OWNER, AppRole.MANAGER],
      parameters: {
        type: 'object',
        properties: {
          alertId: {
            type: 'string',
            description: 'The alert to resolve (from get_active_alerts).',
          },
          all: {
            type: 'boolean',
            description: 'Resolve every unresolved alert instead of one.',
          },
        },
        required: [],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        if (args.all === true) {
          const open = await this.prisma.db.alert.count({
            where: { organizationId: ctx.organizationId, resolvedAt: null },
          });
          if (open === 0) {
            throw new BadRequestException(
              'There are no unresolved alerts to clear.',
            );
          }
          return {
            args: { all: true },
            summary: `Resolve all ${open} unresolved alert${open === 1 ? '' : 's'}`,
            diff: {
              before: { unresolvedAlerts: open },
              after: { unresolvedAlerts: 0 },
            },
            riskLevel: 'low',
          };
        }
        const alertId = asString(args.alertId, 'alertId', 100);
        const alert = await this.prisma.db.alert.findFirst({
          where: { id: alertId, organizationId: ctx.organizationId },
          select: { id: true, title: true, status: true },
        });
        if (!alert) {
          throw new BadRequestException(
            'No matching alert in this organization.',
          );
        }
        if (alert.status === 'RESOLVED') {
          throw new BadRequestException('That alert is already resolved.');
        }
        return {
          args: { alertId: alert.id },
          summary: `Resolve alert \u201c${alert.title}\u201d`,
          diff: {
            before: { status: alert.status },
            after: { status: 'RESOLVED' },
          },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        if (args.all === true) {
          return this.alerts.resolveAllAlerts(ctx.organizationId);
        }
        return this.alerts.resolveAlert(
          asString(args.alertId, 'alertId', 100),
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
