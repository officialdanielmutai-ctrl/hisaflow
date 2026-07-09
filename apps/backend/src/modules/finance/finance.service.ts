import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateBusinessTransactionDto } from './dto/create-business-transaction.dto';
import { UpdateBusinessTransactionDto } from './dto/update-business-transaction.dto';

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

export interface PriceSuggestion {
  itemId: string;
  name: string;
  unit: string;
  currentCostPrice: number | null;
  currentSellingPrice: number | null;
  suggestedCostPrice: number | null;
  suggestedSellingPrice: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
}

export interface BusinessTransactionRecord {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string | null;
  staffName: string | null;
  date: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

export interface BusinessOverview {
  // Inventory-derived
  totalInventoryValue: number;
  totalPotentialRevenue: number;
  grossRevenue: number;
  grossCogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  unpricedCount: number;
  dailyTrend: DailyFinancialPoint[];
  // Operating expenses
  totalOperatingExpenses: number;
  totalManualIncome: number;
  netProfit: number;
  netMarginPct: number | null;
  expensesByCategory: ExpenseCategoryBreakdown[];
  // Period comparison
  thisMonth: { revenue: number; expenses: number; netProfit: number };
  lastMonth: { revenue: number; expenses: number; netProfit: number };
  // Date range info
  dateMode: 'rolling30' | 'calendar';
  periodStart: string;
  periodEnd: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── 1. Inventory-only Financial Overview (legacy, kept for backward compat) ─
  async getOverview(organizationId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
    });

    const totalInventoryValue = allItems.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.costPrice ?? 0);
    }, 0);

    const totalPotentialRevenue = allItems.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.sellingPrice ?? 0);
    }, 0);

    const unpricedCount = allItems.filter(
      (i) => i.costPrice == null || i.sellingPrice == null,
    ).length;

    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, type: 'SALE', createdAt: { gte: thirtyDaysAgo } },
      include: { item: { select: { costPrice: true, sellingPrice: true } } },
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    for (const tx of transactions) {
      const qty = Math.abs(Number(tx.quantityChange));
      totalRevenue += qty * Number(tx.item.sellingPrice ?? 0);
      totalCogs += qty * Number(tx.item.costPrice ?? 0);
    }
    const totalProfit = totalRevenue - totalCogs;
    const grossMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
    const dailyTrend = await this.getDailyTrend(organizationId, thirtyDaysAgo);

    return { totalInventoryValue, totalPotentialRevenue, totalRevenue, totalCogs, totalProfit, grossMarginPct, unpricedCount, dailyTrend };
  }

  // ── 2. Full Business P&L Overview ─────────────────────────────────────────
  async getBusinessOverview(
    organizationId: string,
    dateMode: 'rolling30' | 'calendar' = 'rolling30',
  ): Promise<BusinessOverview> {
    const { start, end } = this.getDateRange(dateMode);

    // Inventory data
    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
    });

    const totalInventoryValue = allItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.costPrice ?? 0), 0,
    );
    const totalPotentialRevenue = allItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.sellingPrice ?? 0), 0,
    );
    const unpricedCount = allItems.filter(
      (i) => i.costPrice == null || i.sellingPrice == null,
    ).length;

    // Inventory sales in period
    const saleTxs = await this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, type: 'SALE', createdAt: { gte: start, lte: end } },
      include: { item: { select: { costPrice: true, sellingPrice: true } } },
    });

    let grossRevenue = 0;
    let grossCogs = 0;
    for (const tx of saleTxs) {
      const qty = Math.abs(Number(tx.quantityChange));
      grossRevenue += qty * Number(tx.item.sellingPrice ?? 0);
      grossCogs += qty * Number(tx.item.costPrice ?? 0);
    }
    const grossProfit = grossRevenue - grossCogs;
    const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : null;

    // Daily trend
    const dailyTrend = await this.getDailyTrend(organizationId, start, end);

    // Business transactions in period
    const bizTxs = await this.prisma.db.businessTransaction.findMany({
      where: { organizationId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' },
    });

    const expenses = bizTxs.filter((t) => t.type === 'EXPENSE');
    const manualIncomes = bizTxs.filter((t) => t.type === 'INCOME');

    const totalOperatingExpenses = expenses.reduce(
      (s, t) => s + Number(t.amount), 0,
    );
    const totalManualIncome = manualIncomes.reduce(
      (s, t) => s + Number(t.amount), 0,
    );

    const netProfit = grossProfit + totalManualIncome - totalOperatingExpenses;
    const totalNetRevenue = grossRevenue + totalManualIncome;
    const netMarginPct = totalNetRevenue > 0 ? (netProfit / totalNetRevenue) * 100 : null;

    // Expense breakdown by category
    const categoryMap = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const existing = categoryMap.get(e.category) ?? { total: 0, count: 0 };
      categoryMap.set(e.category, {
        total: existing.total + Number(e.amount),
        count: existing.count + 1,
      });
    }
    const expensesByCategory: ExpenseCategoryBreakdown[] = Array.from(
      categoryMap.entries(),
    ).map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total);

    // Month comparison
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
      totalManualIncome,
      netProfit,
      netMarginPct,
      expensesByCategory,
      thisMonth,
      lastMonth,
      dateMode,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }

  // ── 3. CRUD: Business Transactions ────────────────────────────────────────
  async createBusinessTransaction(
    organizationId: string,
    dto: CreateBusinessTransactionDto,
  ): Promise<BusinessTransactionRecord> {
    const record = await this.prisma.db.businessTransaction.create({
      data: {
        organizationId,
        type: dto.type,
        category: dto.category,
        amount: dto.amount,
        description: dto.description ?? null,
        staffName: dto.staffName ?? null,
        date: dto.date ? new Date(dto.date) : new Date(),
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule ?? null,
      },
    });
    return this.mapBusinessTx(record);
  }

  async getBusinessTransactions(
    organizationId: string,
    filters?: {
      type?: 'INCOME' | 'EXPENSE';
      category?: string;
      from?: string;
      to?: string;
    },
  ): Promise<BusinessTransactionRecord[]> {
    const where: any = { organizationId };
    if (filters?.type) where.type = filters.type;
    if (filters?.category) where.category = filters.category;
    if (filters?.from || filters?.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(filters.to);
    }
    const records = await this.prisma.db.businessTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    });
    return records.map(this.mapBusinessTx);
  }

  async deleteBusinessTransaction(
    id: string,
    organizationId: string,
  ): Promise<void> {
    await this.prisma.db.businessTransaction.deleteMany({
      where: { id, organizationId },
    });
  }

  async updateBusinessTransaction(
    id: string,
    organizationId: string,
    dto: UpdateBusinessTransactionDto,
  ): Promise<BusinessTransactionRecord> {
    // Verify ownership first
    const existing = await this.prisma.db.businessTransaction.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new Error('Transaction not found');

    const data: any = {};
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.staffName !== undefined) data.staffName = dto.staffName;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.recurrenceRule !== undefined) data.recurrenceRule = dto.recurrenceRule;
    if (dto.date !== undefined) data.date = new Date(dto.date);

    const updated = await this.prisma.db.businessTransaction.update({
      where: { id },
      data,
    });
    return this.mapBusinessTx(updated);
  }

  // ── 4. Single Item Financial Profile ───────────────────────────────────────
  async getItemProfile(itemId: string, organizationId: string): Promise<ItemFinancialProfile> {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!item) throw new Error('Item not found');

    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, itemId, type: 'SALE' },
      orderBy: { createdAt: 'asc' },
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    for (const tx of transactions) {
      const qty = Math.abs(Number(tx.quantityChange));
      totalRevenue += qty * Number(item.sellingPrice ?? 0);
      totalCogs += qty * Number(item.costPrice ?? 0);
    }
    const totalProfit = totalRevenue - totalCogs;
    const grossMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyTrend = await this.getItemDailyTrend(itemId, organizationId, item, thirtyDaysAgo);

    return {
      id: item.id, name: item.name, unit: item.unit,
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
      currentStock: Number(item.quantity),
      stockValue: Number(item.quantity) * Number(item.costPrice ?? 0),
      totalRevenue, totalCogs, totalProfit, grossMarginPct, dailyTrend,
    };
  }

  // ── 5. AI CFO Forecast (now opex-aware) ────────────────────────────────────
  async getForecast(organizationId: string): Promise<{ insights: Array<{ title: string; body: string; sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' }> }> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    const [overview, org] = await Promise.all([
      this.getBusinessOverview(organizationId, 'rolling30'),
      this.prisma.db.organization.findUnique({ where: { id: organizationId }, select: { businessType: true } })
    ]);
    const businessType = org?.businessType ?? 'Retail';

    const prompt = `You are a Chief Financial Officer (CFO) advising a small business owner in Kenya.
The business type is: ${businessType}. Adapt your vocabulary (e.g. for an ISP use terms like truck rolls, installations, service contracts; for a Chemist use terms like regulatory waste, expiry risk).
Here is their current financial data for the last 30 days:

Gross Revenue (from sales): KES ${overview.grossRevenue.toFixed(2)}
Gross Profit (sales minus cost of goods): KES ${overview.grossProfit.toFixed(2)}
Gross Margin: ${overview.grossMarginPct != null ? overview.grossMarginPct.toFixed(1) + '%' : 'N/A'}
Total Operating Expenses (rent, salaries, bills, etc.): KES ${overview.totalOperatingExpenses.toFixed(2)}
Net Profit (after all expenses): KES ${overview.netProfit.toFixed(2)}
Net Margin: ${overview.netMarginPct != null ? overview.netMarginPct.toFixed(1) + '%' : 'N/A'}
Inventory Value (at cost): KES ${overview.totalInventoryValue.toFixed(2)}
Items Without Prices: ${overview.unpricedCount}
Expense Breakdown: ${overview.expensesByCategory.map((e) => `${e.category}: KES ${e.total.toFixed(0)}`).join(', ') || 'No expenses logged yet'}

Provide 4 short, honest, actionable financial insights this owner should know right now.
Format your response as a JSON array of objects:
{ "title": "<short title>", "body": "<2-3 plain sentences>", "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL" }

Rules:
- Use plain language a non-accountant can understand. No jargon.
- Be honest about net losses if the data shows them.
- If operating expenses are high relative to profit, address this directly.
- Include at least one tip on cost control or pricing if net margin is below 15%.
- Return ONLY the JSON array, no markdown fences.`;

    if (!apiKey) return this.fallbackForecast();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
      });
      if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
      const data = await response.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return { insights: parsed };
      throw new Error('Invalid structure');
    } catch {
      return this.fallbackForecast();
    }
  }

  // ── 6. AI Price Suggestions ─────────────────────────────────────────────────
  async getPriceSuggestions(organizationId: string): Promise<PriceSuggestion[]> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true, OR: [{ costPrice: null }, { sellingPrice: null }] },
    });
    if (items.length === 0) return [];
    if (!apiKey) return this.fallbackSuggestions(items);

    const itemList = items
      .map((i) => `- "${i.name}" (unit: ${i.unit}, category: ${i.category ?? 'general'}, costPrice: ${i.costPrice ?? 'unknown'}, sellingPrice: ${i.sellingPrice ?? 'unknown'})`)
      .join('\n');

    const prompt = `You are a pricing expert familiar with Kenyan retail market prices (in KES).
For each item below, suggest a realistic costPrice and sellingPrice in KES.
Items that already have a price set should still be returned but only suggest the missing field.

Items:
${itemList}

Return a JSON array with one object per item:
{
  "name": "<exact item name as given>",
  "suggestedCostPrice": <number in KES>,
  "suggestedSellingPrice": <number in KES>,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "note": "<one sentence explaining the basis for the price>"
}

Rules:
- Suggested selling price must always be higher than cost price.
- Use realistic Kenyan market prices.
- Return ONLY the JSON array, no markdown.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });
      if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
      const data = await response.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const suggestions: any[] = JSON.parse(cleaned);

      return items.map((item) => {
        const suggestion = suggestions.find(
          (s) => s.name.toLowerCase() === item.name.toLowerCase(),
        );
        return {
          itemId: item.id, name: item.name, unit: item.unit,
          currentCostPrice: item.costPrice != null ? Number(item.costPrice) : null,
          currentSellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
          suggestedCostPrice: suggestion?.suggestedCostPrice ?? null,
          suggestedSellingPrice: suggestion?.suggestedSellingPrice ?? null,
          confidence: (suggestion?.confidence as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'LOW',
          note: suggestion?.note ?? 'No suggestion available.',
        };
      });
    } catch {
      return this.fallbackSuggestions(items);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getDateRange(dateMode: 'rolling30' | 'calendar'): { start: Date; end: Date } {
    const now = new Date();
    if (dateMode === 'calendar') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end: now };
  }

  private async getMonthSummary(
    organizationId: string,
    monthsAgo: number,
  ): Promise<{ revenue: number; expenses: number; netProfit: number }> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);

    const saleTxs = await this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, type: 'SALE', createdAt: { gte: start, lte: end } },
      include: { item: { select: { costPrice: true, sellingPrice: true } } },
    });

    let revenue = 0;
    let cogs = 0;
    for (const tx of saleTxs) {
      const qty = Math.abs(Number(tx.quantityChange));
      revenue += qty * Number(tx.item.sellingPrice ?? 0);
      cogs += qty * Number(tx.item.costPrice ?? 0);
    }

    const bizTxs = await this.prisma.db.businessTransaction.findMany({
      where: { organizationId, date: { gte: start, lte: end } },
    });
    const expenses = bizTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const manualIncome = bizTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);

    return {
      revenue: revenue + manualIncome,
      expenses,
      netProfit: (revenue - cogs) + manualIncome - expenses,
    };
  }

  private mapBusinessTx(record: any): BusinessTransactionRecord {
    return {
      id: record.id,
      type: record.type as 'INCOME' | 'EXPENSE',
      category: record.category,
      amount: Number(record.amount),
      description: record.description,
      staffName: record.staffName,
      date: record.date instanceof Date ? record.date.toISOString().slice(0, 10) : record.date,
      isRecurring: record.isRecurring,
      recurrenceRule: record.recurrenceRule,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
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
    itemId: string, organizationId: string,
    item: { costPrice: any; sellingPrice: any }, from: Date,
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

  private fallbackForecast() {
    return {
      insights: [
        { title: 'Track All Costs', body: 'Log your rent, salaries, and utility bills so your Net Profit figure is accurate. Right now only inventory costs are tracked.', sentiment: 'NEUTRAL' as const },
        { title: 'Watch Your Margins', body: 'Your gross margin shows what you keep after buying stock. Aim for at least 15–30% to cover operating expenses.', sentiment: 'NEUTRAL' as const },
        { title: 'Control Operating Costs', body: 'Rent, staff, and utilities are fixed costs that eat into profit every month. Track them consistently to spot savings opportunities.', sentiment: 'NEUTRAL' as const },
        { title: 'Keep Records Updated', body: 'Log every sale, expense, and restock consistently so your financial picture stays accurate.', sentiment: 'NEUTRAL' as const },
      ],
    };
  }

  private fallbackSuggestions(items: any[]): PriceSuggestion[] {
    return items.map((item) => ({
      itemId: item.id, name: item.name, unit: item.unit,
      currentCostPrice: item.costPrice != null ? Number(item.costPrice) : null,
      currentSellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
      suggestedCostPrice: null, suggestedSellingPrice: null,
      confidence: 'LOW' as const,
      note: 'Automatic suggestion unavailable. Please enter prices manually.',
    }));
  }
}
