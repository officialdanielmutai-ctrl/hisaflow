import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import type { DailyFinancialPoint, ExpenseCategoryBreakdown } from './finance.service';

export interface BreakdownRow {
  key: string;
  label: string;
  amount: number;
  count?: number;
  detail?: string;
}

export interface BreakdownGroup {
  key: string;
  title: string;
  rows: BreakdownRow[];
}

export interface FinanceLeak {
  key: string;
  label: string;
  amount: number;
  detail?: string;
}

/**
 * Vertical-agnostic financial view. `revenue` always means the money the
 * business earned from its core activity for the period, whichever vertical it
 * is; `breakdowns` explains where that money came from and what ate into it.
 */
export interface FinanceBreakdown {
  businessType: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  otherIncome: number;
  operatingExpenses: number;
  maintenanceCosts: number;
  netProfit: number;
  netMarginPct: number | null;
  dailyTrend: DailyFinancialPoint[];
  expensesByCategory: ExpenseCategoryBreakdown[];
  breakdowns: BreakdownGroup[];
  leaks: FinanceLeak[];
}

interface ExternalRevenue {
  total: number;
  usesExternal: boolean;
  byGroup: BreakdownRow[];
  mix: BreakdownRow[];
  daily: { amount: number; date: Date }[];
}

const EMPTY_EXTERNAL: ExternalRevenue = {
  total: 0,
  usesExternal: false,
  byGroup: [],
  mix: [],
  daily: [],
};

/** Verticals whose revenue is invoiced rather than (only) inventory sales. */
const INVOICE_REVENUE_VERTICALS = ['GUEST_HOUSE', 'ISP'];

@Injectable()
export class FinanceBreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  async getBreakdown(
    organizationId: string,
    start: Date,
    end: Date,
  ): Promise<FinanceBreakdown> {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { businessType: true },
    });
    const businessType = org?.businessType ?? 'DUKA';

    const [inventoryTx, manualTx, roomIssues, external] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId,
          type: { in: ['SALE', 'WASTAGE'] },
          createdAt: { gte: start, lte: end },
        },
        include: {
          item: { select: { name: true, costPrice: true, sellingPrice: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.businessTransaction.findMany({
        where: { organizationId, date: { gte: start, lte: end } },
      }),
      this.prisma.db.roomIssue.findMany({
        where: { organizationId, createdAt: { gte: start, lte: end } },
        include: { room: { select: { name: true } } },
      }),
      this.getExternalRevenue(businessType, organizationId, start, end),
    ]);

    // ── Inventory revenue / cost of goods ────────────────────────────────────
    let inventoryRevenue = 0;
    let inventoryCogs = 0;
    let wastageCost = 0;
    const commodityMap = new Map<string, { amount: number; qty: number }>();
    const inventoryDaily = new Map<string, DailyFinancialPoint>();

    for (const tx of inventoryTx) {
      const qty = Math.abs(Number(tx.quantityChange));
      const cost = qty * Number(tx.item.costPrice ?? 0);
      const day = tx.createdAt.toISOString().slice(0, 10);
      const point =
        inventoryDaily.get(day) ??
        { date: day, revenue: 0, cogs: 0, profit: 0, unitsSold: 0 };

      inventoryCogs += cost;
      point.cogs += cost;
      point.unitsSold += qty;

      if (tx.type === 'SALE') {
        const rev = qty * Number(tx.item.sellingPrice ?? 0);
        inventoryRevenue += rev;
        point.revenue += rev;
        const key = tx.item.name;
        const row = commodityMap.get(key) ?? { amount: 0, qty: 0 };
        row.amount += rev;
        row.qty += qty;
        commodityMap.set(key, row);
      } else if (tx.type === 'WASTAGE') {
        wastageCost += cost;
      }

      point.profit = point.revenue - point.cogs;
      inventoryDaily.set(day, point);
    }

    // ── Revenue composition ───────────────────────────────────────────────────
    const usesExternal = INVOICE_REVENUE_VERTICALS.includes(businessType);
    const revenue = usesExternal
      ? external.total
      : businessType === 'SCHOOL'
        ? inventoryRevenue + external.total
        : inventoryRevenue;

    // ── Manual transactions / maintenance ────────────────────────────────────
    let otherIncome = 0;
    let manualExpenses = 0;
    const categoryMap = new Map<string, { total: number; count: number }>();

    for (const tx of manualTx) {
      const amount = Number(tx.amount);
      if (tx.type === 'EXPENSE') {
        manualExpenses += amount;
        const cat = categoryMap.get(tx.category) ?? { total: 0, count: 0 };
        cat.total += amount;
        cat.count += 1;
        categoryMap.set(tx.category, cat);
      } else if (tx.type === 'INCOME') {
        otherIncome += amount;
      }
    }

    const maintenanceCosts = roomIssues.reduce(
      (sum, issue) => sum + Number(issue.cost ?? 0),
      0,
    );
    if (maintenanceCosts > 0) {
      const cat = categoryMap.get('MAINTENANCE') ?? { total: 0, count: 0 };
      cat.total += maintenanceCosts;
      cat.count += roomIssues.length;
      categoryMap.set('MAINTENANCE', cat);
    }

    const expensesByCategory: ExpenseCategoryBreakdown[] = Array.from(
      categoryMap.entries(),
    )
      .map(([category, { total, count }]) => ({ category, total, count }))
      .sort((a, b) => b.total - a.total);

    const operatingExpenses = manualExpenses + maintenanceCosts;
    const grossProfit = revenue - inventoryCogs;
    const netProfit = grossProfit + otherIncome - operatingExpenses;
    const totalIncome = revenue + otherIncome;

    // ── Daily trend (revenue + cogs) ─────────────────────────────────────────
    const dailyMap = new Map<string, DailyFinancialPoint>();
    for (const [date, point] of inventoryDaily) {
      dailyMap.set(date, { ...point });
    }
    // When revenue is invoiced, roll back the inventory revenue we added above
    // (it was the item price, not the invoice value) and add the payments.
    if (usesExternal) {
      for (const point of dailyMap.values()) {
        const inventoryPoint = inventoryDaily.get(point.date);
        point.revenue -= inventoryPoint?.revenue ?? 0;
        point.profit = point.revenue - point.cogs;
      }
    }
    for (const payment of external.daily) {
      const day = payment.date.toISOString().slice(0, 10);
      const point =
        dailyMap.get(day) ?? { date: day, revenue: 0, cogs: 0, profit: 0, unitsSold: 0 };
      point.revenue += payment.amount;
      point.profit = point.revenue - point.cogs;
      dailyMap.set(day, point);
    }
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // ── Breakdown groups ─────────────────────────────────────────────────────
    const commodityRows: BreakdownRow[] = Array.from(commodityMap.entries())
      .map(([label, { amount, qty }]) => ({
        key: label,
        label,
        amount: Math.round(amount * 100) / 100,
        count: Math.round(qty * 1000) / 1000,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const breakdowns: BreakdownGroup[] = [];
    if (usesExternal && external.byGroup.length > 0) {
      breakdowns.push({
        key: 'revenue-source',
        title:
          businessType === 'GUEST_HOUSE'
            ? 'Revenue by room'
            : businessType === 'ISP'
              ? 'Revenue by plan'
              : 'Revenue by source',
        rows: external.byGroup,
      });
      if (external.mix.length > 0) {
        breakdowns.push({ key: 'revenue-mix', title: 'Revenue mix', rows: external.mix });
      }
    } else if (businessType === 'SCHOOL' && external.byGroup.length > 0) {
      breakdowns.push({ key: 'revenue-source', title: 'Fees collected by class', rows: external.byGroup });
    } else if (commodityRows.length > 0) {
      breakdowns.push({
        key: 'revenue-source',
        title: 'Revenue by commodity',
        rows: commodityRows,
      });
    }

    if (businessType === 'GUEST_HOUSE' && roomIssues.length > 0) {
      const byRoom = new Map<string, { amount: number; count: number }>();
      for (const issue of roomIssues) {
        const key = issue.room?.name ?? 'Unassigned';
        const row = byRoom.get(key) ?? { amount: 0, count: 0 };
        row.amount += Number(issue.cost ?? 0);
        row.count += 1;
        byRoom.set(key, row);
      }
      breakdowns.push({
        key: 'maintenance-by-room',
        title: 'Maintenance by room',
        rows: Array.from(byRoom.entries())
          .map(([label, { amount, count }]) => ({ key: label, label, amount, count }))
          .sort((a, b) => b.amount - a.amount),
      });
    }

    if (expensesByCategory.length > 0) {
      breakdowns.push({
        key: 'expenses-by-category',
        title: 'Expenses by category',
        rows: expensesByCategory.map((row) => ({
          key: row.category,
          label: row.category,
          amount: row.total,
          count: row.count,
        })),
      });
    }

    // ── Leaks: money the business is losing or has not collected ─────────────
    const leaks = await this.getLeaks({
      organizationId,
      businessType,
      wastageCost,
      maintenanceCosts,
      roomIssues,
    });

    return {
      businessType,
      revenue,
      cogs: inventoryCogs,
      grossProfit,
      grossMarginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
      otherIncome,
      operatingExpenses,
      maintenanceCosts,
      netProfit,
      netMarginPct: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 1000) / 10 : null,
      dailyTrend,
      expensesByCategory,
      breakdowns: breakdowns.filter((group) => group.rows.length > 0),
      leaks,
    };
  }

  // ── External (invoiced) revenue ─────────────────────────────────────────────
  private async getExternalRevenue(
    businessType: string,
    organizationId: string,
    start: Date,
    end: Date,
  ): Promise<ExternalRevenue> {
    if (businessType === 'GUEST_HOUSE') {
      const payments = await this.prisma.db.payment.findMany({
        where: {
          invoice: { organizationId, bookingId: { not: null } },
          recordedAt: { gte: start, lte: end },
        },
        include: {
          invoice: {
            include: { booking: { include: { room: { select: { name: true } } } } },
          },
        },
      });

      let roomCharges = 0;
      let serviceCharges = 0;
      const byRoom = new Map<string, { amount: number; count: number }>();
      const daily: { amount: number; date: Date }[] = [];
      let total = 0;

      for (const payment of payments) {
        const amount = Number(payment.amount);
        const label = payment.invoice.booking?.room?.name ?? 'Unassigned';
        const row = byRoom.get(label) ?? { amount: 0, count: 0 };
        row.amount += amount;
        row.count += 1;
        byRoom.set(label, row);

        const roomTotal = Number(payment.invoice.roomTotal);
        const serviceTotal =
          Number(payment.invoice.consumptionTotal) + Number(payment.invoice.adjustmentsTotal);
        const composition = roomTotal + serviceTotal;
        if (composition > 0) {
          roomCharges += amount * (roomTotal / composition);
          serviceCharges += amount * (serviceTotal / composition);
        }
        total += amount;
        daily.push({ amount, date: payment.recordedAt });
      }

      return {
        total,
        usesExternal: true,
        byGroup: Array.from(byRoom.entries())
          .map(([label, { amount, count }]) => ({ key: label, label, amount, count }))
          .sort((a, b) => b.amount - a.amount),
        mix: [
          { key: 'room', label: 'Room charges', amount: Math.round(roomCharges) },
          { key: 'services', label: 'Services & extras', amount: Math.round(serviceCharges) },
        ].filter((row) => row.amount > 0),
        daily,
      };
    }

    if (businessType === 'ISP') {
      const payments = await this.prisma.db.payment.findMany({
        where: {
          invoice: { organizationId, subscriberId: { not: null } },
          recordedAt: { gte: start, lte: end },
        },
        include: {
          invoice: { include: { plan: { select: { name: true } } } },
        },
      });

      const byPlan = new Map<string, { amount: number; count: number }>();
      const daily: { amount: number; date: Date }[] = [];
      let total = 0;
      for (const payment of payments) {
        const amount = Number(payment.amount);
        const label = payment.invoice.plan?.name ?? 'Unassigned plan';
        const row = byPlan.get(label) ?? { amount: 0, count: 0 };
        row.amount += amount;
        row.count += 1;
        byPlan.set(label, row);
        total += amount;
        daily.push({ amount, date: payment.recordedAt });
      }

      return {
        total,
        usesExternal: true,
        byGroup: Array.from(byPlan.entries())
          .map(([label, { amount, count }]) => ({ key: label, label, amount, count }))
          .sort((a, b) => b.amount - a.amount),
        mix: [],
        daily,
      };
    }

    if (businessType === 'SCHOOL') {
      const payments = await this.prisma.db.feePayment.findMany({
        where: { invoice: { organizationId }, recordedAt: { gte: start, lte: end } },
        include: {
          invoice: { include: { student: { include: { class: { select: { name: true } } } } } },
        },
      });

      const byClass = new Map<string, { amount: number; count: number }>();
      const daily: { amount: number; date: Date }[] = [];
      let total = 0;
      for (const payment of payments) {
        const amount = Number(payment.amount);
        const label = payment.invoice.student?.class?.name ?? 'Unassigned class';
        const row = byClass.get(label) ?? { amount: 0, count: 0 };
        row.amount += amount;
        row.count += 1;
        byClass.set(label, row);
        total += amount;
        daily.push({ amount, date: payment.recordedAt });
      }

      return {
        total,
        usesExternal: false,
        byGroup: Array.from(byClass.entries())
          .map(([label, { amount, count }]) => ({ key: label, label, amount, count }))
          .sort((a, b) => b.amount - a.amount),
        mix: [],
        daily,
      };
    }

    return EMPTY_EXTERNAL;
  }

  // ── Leaks ───────────────────────────────────────────────────────────────────
  private async getLeaks(input: {
    organizationId: string;
    businessType: string;
    wastageCost: number;
    maintenanceCosts: number;
    roomIssues: { status: string }[];
  }): Promise<FinanceLeak[]> {
    const { organizationId, businessType, wastageCost, maintenanceCosts } = input;
    const leaks: FinanceLeak[] = [];

    if (wastageCost > 0) {
      leaks.push({
        key: 'wastage',
        label: 'Stock written off',
        amount: wastageCost,
        detail: 'Wastage and spoilage at cost price.',
      });
    }

    if (maintenanceCosts > 0) {
      leaks.push({
        key: 'maintenance',
        label: 'Repair & maintenance',
        amount: maintenanceCosts,
        detail: 'Reported room faults.',
      });
    }

    if (businessType === 'GUEST_HOUSE' || businessType === 'ISP') {
      const invoices = await this.prisma.db.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['ISSUED', 'PARTIAL'] },
          ...(businessType === 'GUEST_HOUSE'
            ? { bookingId: { not: null } }
            : { subscriberId: { not: null } }),
        },
        select: {
          roomTotal: true,
          consumptionTotal: true,
          adjustmentsTotal: true,
          amountPaid: true,
        },
      });
      const outstanding = invoices.reduce(
        (sum, inv) =>
          sum +
          Math.max(
            0,
            Number(inv.roomTotal) +
              Number(inv.consumptionTotal) +
              Number(inv.adjustmentsTotal) -
              Number(inv.amountPaid),
          ),
        0,
      );
      if (outstanding > 0) {
        leaks.push({
          key: 'outstanding-invoices',
          label: 'Uncollected invoices',
          amount: outstanding,
          detail: 'Issued or partially paid invoices.',
        });
      }
    }

    if (businessType === 'SCHOOL') {
      const invoices = await this.prisma.db.feeInvoice.findMany({
        where: { organizationId, status: { in: ['ISSUED', 'PARTIAL'] } },
        select: { totalExpected: true, adjustmentsTotal: true, amountPaid: true },
      });
      const outstanding = invoices.reduce(
        (sum, inv) =>
          sum +
          Math.max(
            0,
            Number(inv.totalExpected) - Number(inv.adjustmentsTotal) - Number(inv.amountPaid),
          ),
        0,
      );
      if (outstanding > 0) {
        leaks.push({
          key: 'outstanding-fees',
          label: 'Uncollected fees',
          amount: outstanding,
          detail: 'Issued or partially paid fee invoices.',
        });
      }
    }

    if (['DUKA', 'MINI_MART', 'WHOLESALER', 'CHEMIST', 'RESTAURANT'].includes(businessType)) {
      const credits = await this.prisma.db.creditRecord.findMany({
        where: { organizationId, status: { in: ['UNPAID', 'PARTIAL'] } },
        select: { amountTotal: true, amountPaid: true },
      });
      const outstanding = credits.reduce(
        (sum, credit) => sum + Math.max(0, Number(credit.amountTotal) - Number(credit.amountPaid)),
        0,
      );
      if (outstanding > 0) {
        leaks.push({
          key: 'outstanding-credit',
          label: 'Unpaid customer credit',
          amount: outstanding,
          detail: 'Goods taken on credit and not yet paid.',
        });
      }
    }

    if (businessType === 'CHEMIST') {
      const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const batches = await this.prisma.db.stockBatch.findMany({
        where: { organizationId, quantity: { gt: 0 }, expiryDate: { lte: soon } },
        select: { quantity: true, inventoryItem: { select: { costPrice: true } } },
      });
      const expiringValue = batches.reduce(
        (sum, batch) =>
          sum + Number(batch.quantity) * Number(batch.inventoryItem?.costPrice ?? 0),
        0,
      );
      if (expiringValue > 0) {
        leaks.push({
          key: 'expiring-stock',
          label: 'Stock expiring within 30 days',
          amount: expiringValue,
          detail: 'At cost price; sell or write off before expiry.',
        });
      }
    }

    return leaks.sort((a, b) => b.amount - a.amount);
  }
}
