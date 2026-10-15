import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateBusinessTransactionDto } from './dto/create-business-transaction.dto';
import { UpdateBusinessTransactionDto } from './dto/update-business-transaction.dto';
import { BusinessTransactionsService, BusinessTransactionRecord } from './business-transactions.service';
import { FinanceAiService, PriceSuggestion } from './finance-ai.service';
import { FinanceBreakdownService, FinanceBreakdown } from './finance-breakdown.service';

export { BusinessTransactionRecord } from './business-transactions.service';
export { PriceSuggestion } from './finance-ai.service';
export type { FinanceBreakdown } from './finance-breakdown.service';

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface DailyFinancialPoint {
  date: string;
  revenue: number;
  cogs: number;
  profit: number;
  unitsSold: number;
}

export interface ItemFinancialProfile {
  id: string;
  name: string;
  unit: string;
  costPrice: number | null;
  sellingPrice: number | null;
  currentStock: number;
  stockValue: number;
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  grossMarginPct: number | null;
  dailyTrend: DailyFinancialPoint[];
}

export interface ExpenseCategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

export interface BusinessOverview {
  totalInventoryValue: number;
  totalPotentialRevenue: number;
  grossRevenue: number;
  grossCogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  unpricedCount: number;
  dailyTrend: DailyFinancialPoint[];
  totalOperatingExpenses: number;
  totalOtherIncome: number;
  netProfit: number;
  netMarginPct: number | null;
  expensesByCategory: ExpenseCategoryBreakdown[];
  thisMonth: { revenue: number; expenses: number; netProfit: number };
  lastMonth: { revenue: number; expenses: number; netProfit: number };
  periodDays: number;
  dateMode: 'rolling30' | 'calendar';
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly businessTxService: BusinessTransactionsService,
    private readonly financeAiService: FinanceAiService,
    private readonly financeBreakdown: FinanceBreakdownService,
  ) {}

  // ── 1. Legacy Overview (backwards compatibility) ───────────────────────────
  async getOverview(organizationId: string) {
    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, costPrice: true, sellingPrice: true, quantity: true },
    });

    let totalInventoryValue = 0;
    let totalPotentialRevenue = 0;
    let unpricedCount = 0;

    for (const item of items) {
      const qty = Number(item.quantity);
      const cost = item.costPrice != null ? Number(item.costPrice) : null;
      const sell = item.sellingPrice != null ? Number(item.sellingPrice) : null;

      if (cost != null) totalInventoryValue += qty * cost;
      if (sell != null) totalPotentialRevenue += qty * sell;
      if (cost == null || sell == null) unpricedCount++;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyTrend = await this.getDailyTrend(organizationId, thirtyDaysAgo);

    const grossRevenue = dailyTrend.reduce((s, d) => s + d.revenue, 0);
    const grossCogs = dailyTrend.reduce((s, d) => s + d.cogs, 0);
    const grossProfit = grossRevenue - grossCogs;
    const grossMarginPct =
      grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 1000) / 10 : null;

    return {
      totalInventoryValue,
      totalPotentialRevenue,
      grossRevenue,
      grossCogs,
      grossProfit,
      grossMarginPct,
      unpricedCount,
      dailyTrend,
    };
  }

  // ── 2. Unified Business Overview ──────────────────────────────────────────
  async getBusinessOverview(
    organizationId: string,
    dateMode: 'rolling30' | 'calendar' = 'rolling30',
  ): Promise<BusinessOverview> {
    const { start, end } = this.getDateRange(dateMode);
    const periodDays = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    );

    const [items, breakdown] = await Promise.all([
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, costPrice: true, sellingPrice: true, quantity: true },
      }),
      this.financeBreakdown.getBreakdown(organizationId, start, end),
    ]);

    let totalInventoryValue = 0;
    let totalPotentialRevenue = 0;
    let unpricedCount = 0;
    for (const item of items) {
      const qty = Number(item.quantity);
      const cost = item.costPrice != null ? Number(item.costPrice) : null;
      const sell = item.sellingPrice != null ? Number(item.sellingPrice) : null;
      if (cost != null) totalInventoryValue += qty * cost;
      if (sell != null) totalPotentialRevenue += qty * sell;
      if (cost == null || sell == null) unpricedCount++;
    }

    // Revenue, COGS and net profit are computed vertical-aware so invoiced
    // verticals (guest house, ISP, school) are not understated.
    const grossRevenue = breakdown.revenue;
    const grossCogs = breakdown.cogs;
    const grossProfit = breakdown.grossProfit;
    const grossMarginPct = breakdown.grossMarginPct;
    const totalOperatingExpenses = breakdown.operatingExpenses;
    const totalOtherIncome = breakdown.otherIncome;
    const netProfit = breakdown.netProfit;
    const netMarginPct = breakdown.netMarginPct;
    const expensesByCategory = breakdown.expensesByCategory;
    const dailyTrend = breakdown.dailyTrend;

    const periodLabel =
      dateMode === 'calendar'
        ? start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Last 30 Days';

    // Calendar-month P&L for the "Month Comparison" panel (restored from the
    // pre-refactor implementation dropped in c026970).
    const thisMonth = await this.getMonthSummary(organizationId, 0);
    const lastMonth = await this.getMonthSummary(organizationId, 1);

    return {
      totalInventoryValue,
      totalPotentialRevenue,
      grossRevenue,
      grossCogs,
      grossProfit,
      grossMarginPct,
      unpricedCount,
      dailyTrend,
      totalOperatingExpenses,
      totalOtherIncome,
      netProfit,
      netMarginPct,
      expensesByCategory,
      thisMonth,
      lastMonth,
      periodDays,
      dateMode,
      periodLabel,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }

  // ── 3. Delegated CRUD: Business Transactions ──────────────────────────────
  createBusinessTransaction(
    organizationId: string,
    dto: CreateBusinessTransactionDto,
  ): Promise<BusinessTransactionRecord> {
    return this.businessTxService.createBusinessTransaction(organizationId, dto);
  }

  getBusinessTransactions(
    organizationId: string,
    filters?: {
      type?: 'INCOME' | 'EXPENSE';
      category?: string;
      from?: string;
      to?: string;
    },
  ): Promise<BusinessTransactionRecord[]> {
    return this.businessTxService.getBusinessTransactions(organizationId, filters);
  }

  deleteBusinessTransaction(
    id: string,
    organizationId: string,
  ): Promise<void> {
    return this.businessTxService.deleteBusinessTransaction(id, organizationId);
  }

  updateBusinessTransaction(
    id: string,
    organizationId: string,
    dto: UpdateBusinessTransactionDto,
  ): Promise<BusinessTransactionRecord> {
    return this.businessTxService.updateBusinessTransaction(id, organizationId, dto);
  }

  mapBusinessTx(record: any): BusinessTransactionRecord {
    return this.businessTxService.mapBusinessTx(record);
  }

  // ── 4. Single Item Financial Profile ───────────────────────────────────────
  async getItemProfile(itemId: string, organizationId: string): Promise<ItemFinancialProfile> {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!item) throw new Error('Item not found');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyTrend = await this.getItemDailyTrend(itemId, organizationId, item, thirtyDaysAgo);

    const totalRevenue = dailyTrend.reduce((s, d) => s + d.revenue, 0);
    const totalCogs = dailyTrend.reduce((s, d) => s + d.cogs, 0);
    const totalProfit = totalRevenue - totalCogs;
    const grossMarginPct =
      totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : null;

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
      currentStock: Number(item.quantity),
      stockValue: Number(item.quantity) * Number(item.costPrice ?? 0),
      totalRevenue,
      totalCogs,
      totalProfit,
      grossMarginPct,
      dailyTrend,
    };
  }

  // ── 5. AI CFO Forecast & Price Suggestions (delegated) ─────────────────────
  async getForecast(organizationId: string) {
    const overview = await this.getBusinessOverview(organizationId, 'rolling30');
    return this.financeAiService.getForecast(organizationId, overview);
  }

  getPriceSuggestions(organizationId: string): Promise<PriceSuggestion[]> {
    return this.financeAiService.getPriceSuggestions(organizationId);
  }

  // ── Private Helper: Calendar-month P&L ─────────────────────────────────────
  private async getMonthSummary(
    organizationId: string,
    monthsAgo: number,
  ): Promise<{ revenue: number; expenses: number; netProfit: number }> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);

    const breakdown = await this.financeBreakdown.getBreakdown(organizationId, start, end);
    return {
      revenue: breakdown.revenue + breakdown.otherIncome,
      expenses: breakdown.operatingExpenses,
      netProfit: breakdown.netProfit,
    };
  }

  // ── 6. Vertical-aware breakdown (Finance → Breakdown) ──────────────────────
  async getBreakdown(
    organizationId: string,
    dateMode: 'rolling30' | 'calendar' = 'rolling30',
  ): Promise<FinanceBreakdown> {
    const { start, end } = this.getDateRange(dateMode);
    return this.financeBreakdown.getBreakdown(organizationId, start, end);
  }

  // ── Private Helper: Date Range ─────────────────────────────────────────────
  private getDateRange(dateMode: 'rolling30' | 'calendar'): { start: Date; end: Date } {
    const now = new Date();
    if (dateMode === 'calendar') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }

  private async getDailyTrend(organizationId: string, from: Date, to?: Date): Promise<DailyFinancialPoint[]> {
    const where: any = { organizationId, type: 'SALE', createdAt: { gte: from } };
    if (to) where.createdAt.lte = to;

    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where,
      include: { item: { select: { costPrice: true, sellingPrice: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const map = new Map<string, DailyFinancialPoint>();
    for (const tx of transactions) {
      const dateKey = tx.createdAt.toISOString().slice(0, 10);
      const qty = Math.abs(Number(tx.quantityChange));
      const rev = qty * Number(tx.item.sellingPrice ?? 0);
      const cost = qty * Number(tx.item.costPrice ?? 0);
      const existing = map.get(dateKey) ?? { date: dateKey, revenue: 0, cogs: 0, profit: 0, unitsSold: 0 };
      existing.revenue += rev;
      existing.cogs += cost;
      existing.profit = existing.revenue - existing.cogs;
      existing.unitsSold += qty;
      map.set(dateKey, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getItemDailyTrend(
    itemId: string,
    organizationId: string,
    item: { costPrice: any; sellingPrice: any },
    from: Date,
  ): Promise<DailyFinancialPoint[]> {
    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, itemId, type: 'SALE', createdAt: { gte: from } },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, DailyFinancialPoint>();
    for (const tx of transactions) {
      const dateKey = tx.createdAt.toISOString().slice(0, 10);
      const qty = Math.abs(Number(tx.quantityChange));
      const rev = qty * Number(item.sellingPrice ?? 0);
      const cost = qty * Number(item.costPrice ?? 0);
      const existing = map.get(dateKey) ?? { date: dateKey, revenue: 0, cogs: 0, profit: 0, unitsSold: 0 };
      existing.revenue += rev;
      existing.cogs += cost;
      existing.profit = existing.revenue - existing.cogs;
      existing.unitsSold += qty;
      map.set(dateKey, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}
