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

    const [
      todayTransactions,
      allProducts,
      activeAlerts,
      recommendedActions,
    ] = await Promise.all([
      this.prisma.db.stockTransaction.findMany({
        where: {
          organizationId,
          createdAt: { gte: todayStart },
        },
        include: {
          product: {
            select: {
              sellingPrice: true,
              costPrice: true,
            },
          },
        },
      }),
      this.prisma.db.product.findMany({
        where: { organizationId, isActive: true },
      }),
      this.prisma.db.alert.findMany({
        where: { organizationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.getRecommendedActions(organizationId),
    ]);

    // KPI calculations
    let todaySales = 0;
    let todayExpenses = 0;

    for (const tx of todayTransactions) {
      const qty = Math.abs(Number(tx.quantityChange));
      if (tx.type === 'SALE' && tx.product.sellingPrice != null) {
        todaySales += qty * Number(tx.product.sellingPrice);
      } else if (tx.type === 'PURCHASE' && tx.product.costPrice != null) {
        todayExpenses += qty * Number(tx.product.costPrice);
      }
    }

    const lowStockCount = allProducts.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0
    ).length;

    const profitEstimate = todaySales - todayExpenses;

    // Inventory snapshot
    const total = allProducts.length;
    const healthy = allProducts.filter((p) => Number(p.quantity) > Number(p.reorderThreshold) * 1.5).length;
    const low = allProducts.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.quantity) > 0
    ).length;
    const outOfStock = allProducts.filter((p) => Number(p.quantity) === 0).length;
    const stockHealthPct = total === 0 ? 0 : Math.round((healthy / total) * 100);

    const hour = now.getHours();
    let timeOfDay: 'morning' | 'afternoon' | 'evening';
    if (hour >= 0 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    return {
      greeting: { timeOfDay },
      kpis: {
        todaySales,
        todayExpenses,
        lowStockCount,
        profitEstimate,
      },
      attentionFeed: activeAlerts.map((a) => ({
        id: a.id,
        message: a.message,
        severity: a.severity,
        type: a.type,
      })),
      inventorySnapshot: {
        total,
        healthy,
        low,
        outOfStock,
        stockHealthPct,
      },
      recommendedActions,
    };
  }

  private async getRecommendedActions(organizationId: string) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [lowStockProducts, outOfStockProducts, topSellers] = await Promise.all([
      this.prisma.db.product.findMany({
        where: {
          organizationId,
          isActive: true,
          reorderThreshold: { gt: 0 },
          quantity: { lte: this.prisma.db.product.fields.reorderThreshold },
        },
        select: { name: true, quantity: true, reorderThreshold: true },
      }),
      this.prisma.db.product.findMany({
        where: { organizationId, isActive: true, quantity: 0 },
        select: { name: true },
      }),
      this.prisma.db.stockTransaction.groupBy({
        by: ['productId'],
        where: {
          organizationId,
          type: 'SALE',
          createdAt: { gte: todayStart },
        },
        _sum: { quantityChange: true },
        orderBy: { _sum: { quantityChange: 'desc' } },
        take: 5,
      }),
    ]);

    const lowStockList = lowStockProducts
      .map((p) => `${p.name} (${p.quantity} left, threshold ${p.reorderThreshold})`)
      .join(', ') || 'none';
    const outOfStockList = outOfStockProducts.map((p) => p.name).join(', ') || 'none';
    const topSellersWithNames = await Promise.all(
      topSellers.map(async (ts) => {
        const product = await this.prisma.db.product.findUnique({
          where: { id: ts.productId },
          select: { name: true },
        });
        return `${product?.name ?? 'Unknown'} (${Math.abs(ts._sum.quantityChange ?? 0)} sold)`;
      }),
    );
    const topSellersStr = topSellersWithNames.join(', ') || 'none';

    const prompt = `You are an inventory advisor for a small business in Kenya.
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('No content returned from Gemini');

      // Strip markdown fences if present
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
