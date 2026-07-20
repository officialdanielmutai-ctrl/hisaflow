import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getDashboardSummary(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todayTransactions, allItems, activeAlerts, recommendedActions] =
      await Promise.all([
        this.prisma.db.inventoryTransaction.findMany({
          where: { organizationId, createdAt: { gte: todayStart } },
          include: {
            item: { select: { sellingPrice: true, costPrice: true } },
          },
        }),
        this.prisma.db.inventoryItem.findMany({
          where: { organizationId, isActive: true },
        }),
        this.prisma.db.alert.findMany({
          where: { organizationId, resolvedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        this.prisma.db.organization.findUnique({
          where: { id: organizationId },
          select: { businessType: true },
        }),
      ]);

    const businessType = recommendedActions?.businessType ?? 'DUKA';
    const actions = await this.getRecommendedActions(organizationId, businessType);

    let todaySales = 0;
    let todayExpenses = 0;

    for (const tx of todayTransactions) {
      const qty = Math.abs(Number(tx.quantityChange));
      if (tx.type === 'SALE' && tx.item.sellingPrice != null) {
        todaySales += qty * Number(tx.item.sellingPrice);
      } else if (tx.type === 'PURCHASE' && tx.item.costPrice != null) {
        todayExpenses += qty * Number(tx.item.costPrice);
      }
    }

    const lowStockCount = allItems.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0,
    ).length;

    const profitEstimate = todaySales - todayExpenses;

    const total = allItems.length;
    const healthy = allItems.filter(
      (p) => Number(p.quantity) > Number(p.reorderThreshold) * 1.5,
    ).length;
    const low = allItems.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.quantity) > 0,
    ).length;
    const outOfStock = allItems.filter((p) => Number(p.quantity) === 0).length;
    const stockHealthPct = total === 0 ? 0 : Math.round((healthy / total) * 100);

    const hour = now.getHours();
    let timeOfDay: 'morning' | 'afternoon' | 'evening';
    if (hour >= 0 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    return {
      greeting: { timeOfDay },
      kpis: { todaySales, todayExpenses, lowStockCount, profitEstimate },
      attentionFeed: activeAlerts.map((a) => ({
        id: a.id,
        message: a.title,          // Alert has 'title', frontend expects 'message'
        severity: a.severity,
        type: a.type,
      })),
      inventorySnapshot: { total, healthy, low, outOfStock, stockHealthPct },
      recommendedActions: actions,
    };
  }

  async getStaffDashboardSummary(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todayTransactions, allItems, activeAlerts, recommendedActions, completedChecklists] =
      await Promise.all([
        this.prisma.db.inventoryTransaction.findMany({
          where: { organizationId, createdAt: { gte: todayStart } },
          include: { item: { select: { sellingPrice: true, costPrice: true } } },
        }),
        this.prisma.db.inventoryItem.findMany({
          where: { organizationId, isActive: true },
        }),
        this.prisma.db.alert.findMany({
          where: { organizationId, resolvedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        this.prisma.db.organization.findUnique({
          where: { id: organizationId },
          select: { businessType: true },
        }),
        this.prisma.db.checklistItem.count({
          where: { note: { organizationId }, isCompleted: true, createdAt: { gte: todayStart } },
        }),
      ]);

    const businessType = recommendedActions?.businessType ?? 'DUKA';
    const actions = await this.getRecommendedActions(organizationId, businessType);

    let todaySalesCount = 0;
    for (const tx of todayTransactions) {
      if (tx.type === 'SALE') {
        todaySalesCount += Math.abs(Number(tx.quantityChange));
      }
    }

    const lowStockCount = allItems.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0,
    ).length;

    const topLowStockItems = allItems
      .filter((p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0)
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit
      }));

    return {
      greeting: { timeOfDay: now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening' },
      kpis: {
        todaySalesCount,
        todaySalesTrend: 18,
        lowStockCount,
        totalInventory: allItems.length,
        tasksDoneToday: completedChecklists,
      },
      attentionFeed: activeAlerts.map((a) => ({
        id: a.id,
        message: a.title,
        severity: a.severity,
        type: a.type,
      })),
      lowStockWatchList: topLowStockItems,
      recommendedActions: actions,
    };
  }

  private async getRecommendedActions(organizationId: string, businessType: string) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Fetch all active items then filter in JS — avoids invalid column-to-column Prisma where
    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, quantity: true, reorderThreshold: true },
    });

    const lowStockItems = allItems.filter(
      (p) => Number(p.reorderThreshold) > 0 && Number(p.quantity) <= Number(p.reorderThreshold),
    );
    const outOfStockItems = allItems.filter((p) => Number(p.quantity) === 0);

    const topSellers = await this.prisma.db.inventoryTransaction.groupBy({
      by: ['itemId'],
      where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
      _sum: { quantityChange: true },
      orderBy: { _sum: { quantityChange: 'asc' } }, // asc = most negative = most sold
      take: 5,
    });

    const lowStockList =
      lowStockItems
        .map((p) => `${p.name} (${p.quantity} left, threshold ${p.reorderThreshold})`)
        .join(', ') || 'none';
    const outOfStockList = outOfStockItems.map((p) => p.name).join(', ') || 'none';

    const topSellersWithNames = await Promise.all(
      topSellers.map(async (ts) => {
        const item = await this.prisma.db.inventoryItem.findUnique({
          where: { id: ts.itemId },
          select: { name: true },
        });
        return `${item?.name ?? 'Unknown'} (${Math.abs(Number(ts._sum.quantityChange ?? 0))} sold)`;
      }),
    );
    const topSellersStr = topSellersWithNames.join(', ') || 'none';

    const prompt = `You are a business and inventory advisor for a small business in Kenya.
The business type is: ${businessType}. Adapt your recommendations and terminology to match this industry (e.g., if ISP, talk about field deployments and hardware stock; if Chemist, talk about medicine expiry and batch tracking).
Based on the following inventory data, generate exactly 3 recommended actions for the business owner.
Be specific, practical, and use plain language.
Format your response as a JSON array of objects with these fields:
{ action: string, reason: string, priority: 'HIGH'|'MEDIUM'|'LOW' }

Current low stock items: ${lowStockList}
Out of stock items: ${outOfStockList}
Top selling items today: ${topSellersStr}

Return ONLY the JSON array, no markdown fences.`;

    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY for recommended actions');
      return this.getFallbackActions();
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('No content returned from Gemini');

      const jsonStr = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (
        Array.isArray(parsed) &&
        parsed.length === 3 &&
        parsed.every((item) => item.action && item.reason && item.priority)
      ) {
        return parsed;
      }
      throw new Error('Invalid response structure');
    } catch (error) {
      console.error('Failed to generate recommended actions:', error);
      return this.getFallbackActions();
    }
  }

  private getFallbackActions() {
    return [
      { action: 'Review your low stock items', reason: 'Some items are running low', priority: 'HIGH' },
      { action: 'Check your top sellers', reason: 'Fast-moving items need restocking', priority: 'MEDIUM' },
      { action: 'Update your inventory', reason: 'Keep your stock records current', priority: 'LOW' },
    ];
  }
}