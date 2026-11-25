import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  DailyPerformancePoint,
  MetricDashboardResponse,
  PeriodComparison,
  ResolvedAnalyticsRange,
  SeriesBucket,
} from './time-buckets';
import { VerticalAnalyticsService } from './vertical-analytics.service';
import { inventoryDisplayName } from '../inventory/inventory-display-name';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  buildZeroFilledSeries,
  computePeriodComparison,
  eatDayBounds,
  eatTimeOfDay,
  effectiveTransactionPurchaseAmount,
  effectiveTransactionSaleAmount,
  resolveAnalyticsRange,
  roundMoney,
  toEatDateKey,
} from './time-buckets';

export interface GrowthTimeframeBucket {
  total: number;
  count: number;
  comparison: PeriodComparison;
}

export interface DashboardSelectedPeriod {
  range: ResolvedAnalyticsRange;
  salesTotal: number;
  expensesTotal: number;
  profitTotal: number;
  salesComparison: PeriodComparison;
  expensesComparison: PeriodComparison;
  profitComparison: PeriodComparison;
  dailyPerformance: DailyPerformancePoint[];
  sevenDaySales: SeriesBucket[];
  sevenDayExpenses: SeriesBucket[];
  sevenDayProfit: SeriesBucket[];
  growthByTimeframe: {
    '12h': GrowthTimeframeBucket;
    '24h': GrowthTimeframeBucket;
    week: GrowthTimeframeBucket;
    month: GrowthTimeframeBucket;
  };
  generatedAt: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verticalAnalytics: VerticalAnalyticsService,
  ) {}

  async getDashboardSummary(
    organizationId: string,
    query?: DashboardQueryDto,
  ) {
    const now = new Date();
    const { start: todayStart } = eatDayBounds(0, now);
    const { start: yesterdayStart } = eatDayBounds(-1, now);

    const resolved = resolveAnalyticsRange(
      { preset: query?.preset, from: query?.from, to: query?.to },
      now,
    );
    const weekWindow = resolveAnalyticsRange({ preset: 'week' }, now);
    const monthWindow = resolveAnalyticsRange({ preset: 'month' }, now);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);

    // Fetch once across the widest needed comparison/history boundary (never .lt so
    // both production ranges and unit test mocks stay clean and deterministic).
    const earliestFetchStart = new Date(
      Math.min(
        resolved.previousStart.getTime(),
        monthWindow.previousStart.getTime(),
        sevenDayWindow.start.getTime(),
        weekWindow.previousStart.getTime(),
      ),
    );

    const [
      todayTransactions,
      yesterdayTransactions,
      windowTransactions,
      allItems,
      activeAlerts,
      orgRecord,
    ] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, createdAt: { gte: todayStart } },
        include: {
          item: { select: { sellingPrice: true, costPrice: true, isComposite: true } },
        },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, createdAt: { gte: yesterdayStart, lt: todayStart } },
        include: {
          item: { select: { sellingPrice: true, costPrice: true, isComposite: true } },
        },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, createdAt: { gte: earliestFetchStart } },
        include: {
          item: { select: { sellingPrice: true, costPrice: true, isComposite: true } },
        },
      }),
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        include: { product: { select: { name: true } } },
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

    const businessType = orgRecord?.businessType ?? 'DUKA';
    const actions = await this.getRecommendedActions(organizationId, businessType);

    let todaySales = 0;
    let todayExpenses = 0;

    for (const tx of todayTransactions) {
      if (tx.type === 'SALE' && tx.item?.sellingPrice != null) {
        todaySales = roundMoney(todaySales + effectiveTransactionSaleAmount(tx));
      } else if (tx.type === 'PURCHASE' && tx.item?.costPrice != null) {
        todayExpenses = roundMoney(todayExpenses + effectiveTransactionPurchaseAmount(tx));
      }
    }

    let yesterdaySales = 0;
    let yesterdayExpenses = 0;

    for (const tx of yesterdayTransactions) {
      if (tx.type === 'SALE' && tx.item?.sellingPrice != null) {
        yesterdaySales = roundMoney(yesterdaySales + effectiveTransactionSaleAmount(tx));
      } else if (tx.type === 'PURCHASE' && tx.item?.costPrice != null) {
        yesterdayExpenses = roundMoney(
          yesterdayExpenses + effectiveTransactionPurchaseAmount(tx),
        );
      }
    }

    // Legacy today-vs-yesterday KPIs preserved for backwards compatibility
    let salesTrendPct = 0;
    if (yesterdaySales === 0 && todaySales > 0) {
      salesTrendPct = 100;
    } else if (yesterdaySales > 0) {
      salesTrendPct = Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100);
    }
    const salesTrendIsPositive = salesTrendPct >= 0;
    const salesTrendLabel = salesTrendPct > 0 ? `+${salesTrendPct}%` : `${salesTrendPct}%`;

    let expensesTrendPct = 0;
    if (yesterdayExpenses === 0 && todayExpenses > 0) {
      expensesTrendPct = 100;
    } else if (yesterdayExpenses > 0) {
      expensesTrendPct = Math.round(
        ((todayExpenses - yesterdayExpenses) / yesterdayExpenses) * 100,
      );
    }
    const expensesTrendIsNegative = expensesTrendPct > 0;
    const expensesTrendLabel =
      expensesTrendPct > 0 ? `+${expensesTrendPct}%` : `${expensesTrendPct}%`;

    const lowStockCount = allItems.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0,
    ).length;

    const profitEstimate = roundMoney(todaySales - todayExpenses);
    const yesterdayProfit = roundMoney(yesterdaySales - yesterdayExpenses);
    let profitTrendPct = 0;
    if (yesterdayProfit === 0 && profitEstimate > 0) {
      profitTrendPct = 100;
    } else if (yesterdayProfit !== 0) {
      profitTrendPct = Math.round(
        ((profitEstimate - yesterdayProfit) / Math.abs(yesterdayProfit)) * 100,
      );
    }
    const profitTrendIsPositive = profitTrendPct >= 0;
    const profitTrendLabel =
      profitTrendPct > 0 ? `+${profitTrendPct}%` : `${profitTrendPct}%`;

    const total = allItems.length;
    const healthy = allItems.filter(
      (p) => Number(p.quantity) > Number(p.reorderThreshold) * 1.5,
    ).length;
    const low = allItems.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.quantity) > 0,
    ).length;
    const outOfStock = allItems.filter((p) => Number(p.quantity) === 0).length;
    const stockHealthPct = total === 0 ? 0 : Math.round((healthy / total) * 100);

    // ── Canonical timeframe-aware EAT series & period comparisons ────────────
    const saleEntries = windowTransactions
      .filter((tx) => tx.type === 'SALE' && tx.item?.sellingPrice != null)
      .map((tx) => ({
        timestamp: tx.createdAt ? new Date(tx.createdAt) : now,
        value: effectiveTransactionSaleAmount(tx),
      }))
      .filter((entry) => entry.value > 0);

    const purchaseEntries = windowTransactions
      .filter((tx) => tx.type === 'PURCHASE' && tx.item?.costPrice != null)
      .map((tx) => ({
        timestamp: tx.createdAt ? new Date(tx.createdAt) : now,
        value: effectiveTransactionPurchaseAmount(tx),
      }))
      .filter((entry) => entry.value > 0);

    const currSales = buildZeroFilledSeries(
      resolved.start,
      resolved.end,
      resolved.range.granularity,
      saleEntries,
    );
    const prevSales = buildZeroFilledSeries(
      resolved.previousStart,
      resolved.previousEnd,
      resolved.range.granularity,
      saleEntries,
    );
    const currExpenses = buildZeroFilledSeries(
      resolved.start,
      resolved.end,
      resolved.range.granularity,
      purchaseEntries,
    );
    const prevExpenses = buildZeroFilledSeries(
      resolved.previousStart,
      resolved.previousEnd,
      resolved.range.granularity,
      purchaseEntries,
    );

    const currProfitTotal = roundMoney(currSales.total - currExpenses.total);
    const prevProfitTotal = roundMoney(prevSales.total - prevExpenses.total);

    // Performance chart & 7-day sparklines: use selected range if daily/monthly,
    // or 7-day EAT daily series when viewing sub-day presets ('today', 'yesterday', '12h', '24h').
    const chartWindow =
      resolved.range.granularity === 'hour' ? sevenDayWindow : resolved;
    const chartGranularity =
      chartWindow.range.granularity === 'hour' ? 'day' : chartWindow.range.granularity;

    const chartSales = buildZeroFilledSeries(
      chartWindow.start,
      chartWindow.end,
      chartGranularity,
      saleEntries,
    );
    const chartExpenses = buildZeroFilledSeries(
      chartWindow.start,
      chartWindow.end,
      chartGranularity,
      purchaseEntries,
    );

    const dailyPerformance: DailyPerformancePoint[] = chartSales.buckets.map((bucket, idx) => {
      const expBucket = chartExpenses.buckets[idx];
      return {
        date: toEatDateKey(new Date(bucket.start)),
        day: bucket.label,
        sales: bucket.value,
        expenses: expBucket?.value ?? 0,
        salesCount: bucket.count,
        expensesCount: expBucket?.count ?? 0,
      };
    });

    const sevenDaySales = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      saleEntries,
    ).buckets;
    const sevenDayExpenses = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      purchaseEntries,
    ).buckets;
    const sevenDayProfit: SeriesBucket[] = sevenDaySales.map((s, idx) => ({
      ...s,
      value: roundMoney(s.value - (sevenDayExpenses[idx]?.value ?? 0)),
      count: s.count + (sevenDayExpenses[idx]?.count ?? 0),
    }));

    const computeGrowthFor = (presetKey: '12h' | '24h' | 'week' | 'month'): GrowthTimeframeBucket => {
      const w = resolveAnalyticsRange({ preset: presetKey }, now);
      const curr = buildZeroFilledSeries(w.start, w.end, w.range.granularity, saleEntries);
      const prev = buildZeroFilledSeries(
        w.previousStart,
        w.previousEnd,
        w.range.granularity,
        saleEntries,
      );
      return {
        total: curr.total,
        count: curr.rowCount,
        comparison: computePeriodComparison(curr.total, prev.total, w.previousLabel),
      };
    };

    const selectedPeriod: DashboardSelectedPeriod = {
      range: resolved.range,
      salesTotal: currSales.total,
      expensesTotal: currExpenses.total,
      profitTotal: currProfitTotal,
      salesComparison: computePeriodComparison(
        currSales.total,
        prevSales.total,
        resolved.previousLabel,
      ),
      expensesComparison: computePeriodComparison(
        currExpenses.total,
        prevExpenses.total,
        resolved.previousLabel,
      ),
      profitComparison: computePeriodComparison(
        currProfitTotal,
        prevProfitTotal,
        resolved.previousLabel,
      ),
      dailyPerformance,
      sevenDaySales,
      sevenDayExpenses,
      sevenDayProfit,
      growthByTimeframe: {
        '12h': computeGrowthFor('12h'),
        '24h': computeGrowthFor('24h'),
        week: computeGrowthFor('week'),
        month: computeGrowthFor('month'),
      },
      generatedAt: now.toISOString(),
    };

    return {
      greeting: { timeOfDay: eatTimeOfDay(now) },
      kpis: {
        todaySales,
        salesTrendLabel,
        salesTrendIsPositive,
        salesTrendPct,
        todayExpenses,
        expensesTrendLabel,
        expensesTrendIsNegative,
        expensesTrendPct,
        lowStockCount,
        profitEstimate,
        profitTrendLabel,
        profitTrendIsPositive,
        profitTrendPct,
      },
      attentionFeed: activeAlerts.map((a) => ({
        id: a.id,
        message: a.title,
        severity: a.severity,
        type: a.type,
      })),
      inventorySnapshot: { total, healthy, low, outOfStock, stockHealthPct },
      recommendedActions: actions,
      selectedPeriod,
    };
  }

  /** Canonical zero-filled metric series endpoint (`GET /analytics/metrics`). */
  async getMetricSeries(
    organizationId: string,
    query: DashboardQueryDto = {},
  ): Promise<MetricDashboardResponse> {
    const now = new Date();
    const resolved = resolveAnalyticsRange(
      { preset: query.preset ?? '7d', from: query.from, to: query.to },
      now,
    );
    const metric = query.metric ?? 'sales.revenue';

    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where: {
        organizationId,
        createdAt: { gte: resolved.previousStart, lt: resolved.end },
      },
      include: {
        item: { select: { sellingPrice: true, costPrice: true, isComposite: true } },
      },
    });

    const entries = transactions
      .map((tx) => {
        const ts = tx.createdAt ? new Date(tx.createdAt) : now;
        if (metric === 'expenses.purchase') {
          return tx.type === 'PURCHASE'
            ? { timestamp: ts, value: effectiveTransactionPurchaseAmount(tx) }
            : null;
        }
        if (metric === 'profit.estimate') {
          if (tx.type === 'SALE') {
            return { timestamp: ts, value: effectiveTransactionSaleAmount(tx) };
          }
          if (tx.type === 'PURCHASE') {
            return { timestamp: ts, value: -effectiveTransactionPurchaseAmount(tx) };
          }
          return null;
        }
        return tx.type === 'SALE'
          ? { timestamp: ts, value: effectiveTransactionSaleAmount(tx) }
          : null;
      })
      .filter((entry): entry is { timestamp: Date; value: number } => entry !== null);

    const currentSeries = buildZeroFilledSeries(
      resolved.start,
      resolved.end,
      resolved.range.granularity,
      entries,
    );
    const previousSeries = buildZeroFilledSeries(
      resolved.previousStart,
      resolved.previousEnd,
      resolved.range.granularity,
      entries,
    );
    const bucketSum = roundMoney(
      currentSeries.buckets.reduce((sum, bucket) => sum + bucket.value, 0),
    );

    return {
      metric,
      range: resolved.range,
      total: currentSeries.total,
      currency: 'KES',
      buckets: currentSeries.buckets,
      comparison: computePeriodComparison(
        currentSeries.total,
        previousSeries.total,
        resolved.previousLabel,
      ),
      meta: {
        generatedAt: now.toISOString(),
        rowCount: currentSeries.rowCount,
        partialPeriod: resolved.range.partialPeriod,
        reconciled: currentSeries.total === bucketSum,
      },
    };
  }

  async getStaffDashboardSummary(organizationId: string) {
    const now = new Date();
    const { start: todayStart } = eatDayBounds(0, now);
    const { start: yesterdayStart } = eatDayBounds(-1, now);

    const [
      todayTransactions,
      yesterdayTransactions,
      allItems,
      activeAlerts,
      orgRecord,
      completedChecklists,
      pendingChecklists,
    ] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true, costPrice: true } } },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        include: { product: { select: { name: true } } },
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
      this.prisma.db.checklistItem.count({
        where: { note: { organizationId }, isCompleted: false },
      }),
    ]);

    const businessType = orgRecord?.businessType ?? 'DUKA';
    const actions = await this.getRecommendedActions(organizationId, businessType);

    let todaySalesCount = 0;
    for (const tx of todayTransactions) {
      if (tx.type === 'SALE' && !(tx.reason ?? '').startsWith('Used in ')) {
        todaySalesCount += Math.abs(Number(tx.quantityChange));
      }
    }

    let yesterdaySalesCount = 0;
    for (const tx of yesterdayTransactions) {
      if (tx.type === 'SALE' && !(tx.reason ?? '').startsWith('Used in ')) {
        yesterdaySalesCount += Math.abs(Number(tx.quantityChange));
      }
    }

    let todaySalesTrend = 0;
    if (yesterdaySalesCount === 0 && todaySalesCount > 0) {
      todaySalesTrend = 100;
    } else if (yesterdaySalesCount > 0) {
      todaySalesTrend = Math.round(
        ((todaySalesCount - yesterdaySalesCount) / yesterdaySalesCount) * 100,
      );
    }

    const lowStockCount = allItems.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0,
    ).length;

    const topLowStockItems = allItems
      .filter(
        (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0,
      )
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        name: inventoryDisplayName(item),
        quantity: Number(item.quantity),
        unit: item.unit,
      }));

    const categoryCount = new Set(allItems.map((i) => i.category || 'Other')).size;

    return {
      greeting: { timeOfDay: eatTimeOfDay(now) },
      kpis: {
        todaySalesCount,
        todaySalesTrend,
        todaySalesTrendLabel:
          yesterdaySalesCount === 0 && todaySalesCount > 0
            ? 'First sales today'
            : todaySalesTrend > 0
              ? `+${todaySalesTrend}% vs yesterday`
              : todaySalesTrend < 0
                ? `${todaySalesTrend}% vs yesterday`
                : 'Same as yesterday',
        lowStockCount,
        totalInventory: allItems.length,
        totalInventoryLabel: `Across ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}`,
        tasksDoneToday: completedChecklists,
        tasksLabel: pendingChecklists > 0 ? `${pendingChecklists} tasks pending` : 'All caught up!',
      },
      attentionFeed: activeAlerts.map((a) => ({
        id: a.id,
        message: a.title,
        severity: a.severity,
        type: a.type,
        createdAt: a.createdAt,
      })),
      lowStockWatchList: topLowStockItems,
      recommendedActions: actions,
    };
  }

  // ── Vertical Dashboards (delegated to VerticalAnalyticsService) ─────────────
  getGuestHouseDashboard(organizationId: string) {
    return this.verticalAnalytics.getGuestHouseDashboard(organizationId);
  }

  getSchoolDashboard(organizationId: string) {
    return this.verticalAnalytics.getSchoolDashboard(organizationId);
  }

  getChemistDashboard(organizationId: string) {
    return this.verticalAnalytics.getChemistDashboard(organizationId);
  }

  getRestaurantDashboard(organizationId: string) {
    return this.verticalAnalytics.getRestaurantDashboard(organizationId);
  }

  getWholesaleDashboard(organizationId: string) {
    return this.verticalAnalytics.getWholesaleDashboard(organizationId);
  }

  // ── Recommended Actions (AI) ───────────────────────────────────────────────
  private async getRecommendedActions(organizationId: string, businessType: string) {
    const { start: todayStart } = eatDayBounds(0);

    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        quantity: true,
        reorderThreshold: true,
        product: { select: { name: true } },
      },
    });

    const lowStockItems = allItems.filter(
      (p) => Number(p.reorderThreshold) > 0 && Number(p.quantity) <= Number(p.reorderThreshold),
    );
    const outOfStockItems = allItems.filter((p) => Number(p.quantity) === 0);

    const topSellers = await this.prisma.db.inventoryTransaction.groupBy({
      by: ['itemId'],
      where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
      _sum: { quantityChange: true },
      orderBy: { _sum: { quantityChange: 'asc' } },
      take: 5,
    });

    const lowStockList =
      lowStockItems
        .map((p) => `${inventoryDisplayName(p)} (${p.quantity} left, threshold ${p.reorderThreshold})`)
        .join(', ') || 'none';
    const outOfStockList = outOfStockItems.map(inventoryDisplayName).join(', ') || 'none';

    const topSellersWithNames = await Promise.all(
      topSellers.map(async (ts) => {
        const item = await this.prisma.db.inventoryItem.findUnique({
          where: { id: ts.itemId },
          select: { name: true, product: { select: { name: true } } },
        });
        return `${item ? inventoryDisplayName(item) : 'Unknown'} (${Math.abs(Number(ts._sum.quantityChange ?? 0))} sold)`;
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

    const baseUrl = this.configService.get<string>('litellm.baseUrl');
    const apiKey = this.configService.get<string>('litellm.masterKey');

    if (!baseUrl || !apiKey) {
      console.error('Missing LiteLLM configuration for recommended actions');
      return this.getFallbackActions();
    }

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    try {
      const response = await openai.chat.completions.create({
        model: 'hisaflow-standard',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const rawText = response.choices?.[0]?.message?.content;
      if (!rawText) throw new Error('No content returned from AI gateway');

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
