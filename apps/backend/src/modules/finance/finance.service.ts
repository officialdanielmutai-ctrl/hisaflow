import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface DailyFinancialPoint {
  date: string;          // ISO date string e.g. "2026-06-30"
  revenue: number;       // Total sales value for that day
  cogs: number;          // Cost of goods sold
  profit: number;        // revenue - cogs
  unitsSold: number;
}

export interface ItemFinancialProfile {
  id: string;
  name: string;
  unit: string;
  costPrice: number | null;
  sellingPrice: number | null;
  currentStock: number;
  stockValue: number;           // quantity × costPrice
  totalRevenue: number;         // all-time SALE revenue
  totalCogs: number;            // all-time SALE cogs
  totalProfit: number;          // totalRevenue - totalCogs
  grossMarginPct: number | null;// (profit / revenue) × 100
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

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── 1. Financial Overview (30-day rolling) ──────────────────────────────────
  async getOverview(organizationId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
    });

    // Total inventory value at cost
    const totalInventoryValue = allItems.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.costPrice ?? 0);
    }, 0);

    // Total potential revenue (at selling price)
    const totalPotentialRevenue = allItems.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.sellingPrice ?? 0);
    }, 0);

    // Items missing prices
    const unpricedCount = allItems.filter(
      (i) => i.costPrice == null || i.sellingPrice == null,
    ).length;

    // Last 30 days transactions for revenue/profit
    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: 'SALE',
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        item: { select: { costPrice: true, sellingPrice: true } },
      },
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

    // Daily trend (last 30 days)
    const dailyTrend = await this.getDailyTrend(organizationId, thirtyDaysAgo);

    return {
      totalInventoryValue,
      totalPotentialRevenue,
      totalRevenue,
      totalCogs,
      totalProfit,
      grossMarginPct,
      unpricedCount,
      dailyTrend,
    };
  }

  // ── 2. Single Item Financial Profile ───────────────────────────────────────
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

  // ── 3. AI CFO Forecast ──────────────────────────────────────────────────────
  async getForecast(organizationId: string): Promise<{ insights: Array<{ title: string; body: string; sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' }> }> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    const overview = await this.getOverview(organizationId);

    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
    });

    const deadStock = allItems.filter((i) => Number(i.quantity) > 0);
    const deadStockValue = deadStock.reduce(
      (s, i) => s + Number(i.quantity) * Number(i.costPrice ?? 0),
      0,
    );

    const prompt = `You are a Chief Financial Officer (CFO) advising a small retail business owner in Kenya.
Here is their current financial data:

Total Inventory Value (at cost): KES ${overview.totalInventoryValue.toFixed(2)}
Total Potential Revenue (if all sold at selling price): KES ${overview.totalPotentialRevenue.toFixed(2)}
30-Day Gross Revenue: KES ${overview.totalRevenue.toFixed(2)}
30-Day Gross Profit: KES ${overview.totalProfit.toFixed(2)}
30-Day Gross Margin: ${overview.grossMarginPct != null ? overview.grossMarginPct.toFixed(1) + '%' : 'N/A'}
Dead Stock Value (items with no recent sales): KES ${deadStockValue.toFixed(2)}
Items Without Prices: ${overview.unpricedCount}

Provide 4 short, honest, actionable financial insights this owner should know right now.
Format your response as a JSON array of objects:
{ "title": "<short title>", "body": "<2-3 plain sentences>", "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL" }

Rules:
- Use plain language a non-accountant can understand. No jargon.
- Be honest about losses if the data shows them.
- Include at least one practical pricing or promotion tip if margins are low.
- Include one dead-stock strategy if dead stock value > 0.
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

  // ── 4. AI Price Suggestions for unpriced items ─────────────────────────────
  async getPriceSuggestions(organizationId: string): Promise<PriceSuggestion[]> {
    const apiKey = this.config.get<string>('gemini.apiKey');

    const items = await this.prisma.db.inventoryItem.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [{ costPrice: null }, { sellingPrice: null }],
      },
    });

    if (items.length === 0) return [];
    if (!apiKey) return this.fallbackSuggestions(items);

    const itemList = items
      .map((i) => `- "${i.name}" (unit: ${i.unit}, category: ${i.category ?? 'general'}, costPrice: ${i.costPrice ?? 'unknown'}, sellingPrice: ${i.sellingPrice ?? 'unknown'})`)
      .join('\n');

    const prompt = `You are a pricing expert familiar with Kenyan retail market prices (in KES).
For each item below, suggest a realistic costPrice and sellingPrice in KES based on typical Kenyan market prices.
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
- Use realistic Kenyan market prices (e.g. Unga 2kg ~120 cost, ~150 sell).
- If the item is very obscure, use LOW confidence.
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
      const suggestions: Array<{ name: string; suggestedCostPrice: number; suggestedSellingPrice: number; confidence: string; note: string }> = JSON.parse(cleaned);

      return items.map((item) => {
        const suggestion = suggestions.find(
          (s) => s.name.toLowerCase() === item.name.toLowerCase(),
        );
        return {
          itemId: item.id,
          name: item.name,
          unit: item.unit,
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

  private async getDailyTrend(organizationId: string, from: Date): Promise<DailyFinancialPoint[]> {
    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: 'SALE',
        createdAt: { gte: from },
      },
      include: {
        item: { select: { costPrice: true, sellingPrice: true } },
      },
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

  private fallbackForecast() {
    return {
      insights: [
        { title: 'Track Your Costs', body: 'Make sure all your items have cost and selling prices set. Without these, accurate profit calculations are not possible.', sentiment: 'NEUTRAL' as const },
        { title: 'Watch Your Margins', body: 'The difference between what you pay for stock and what you sell it for is your profit margin. Aim for at least 15–30%.', sentiment: 'NEUTRAL' as const },
        { title: 'Move Dead Stock', body: 'Items sitting on the shelf tie up your cash. Consider bundling them with popular items or offering a small discount.', sentiment: 'NEUTRAL' as const },
        { title: 'Keep Records Updated', body: 'Log every sale and restock consistently so your financial picture stays accurate and useful.', sentiment: 'NEUTRAL' as const },
      ],
    };
  }

  private fallbackSuggestions(items: any[]): PriceSuggestion[] {
    return items.map((item) => ({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      currentCostPrice: item.costPrice != null ? Number(item.costPrice) : null,
      currentSellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
      suggestedCostPrice: null,
      suggestedSellingPrice: null,
      confidence: 'LOW' as const,
      note: 'Automatic suggestion unavailable. Please enter prices manually.',
    }));
  }
}
