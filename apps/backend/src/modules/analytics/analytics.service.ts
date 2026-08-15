import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
        message: a.title,
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
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [todayTransactions, yesterdayTransactions, allItems, activeAlerts, recommendedActions, completedChecklists, pendingChecklists] =
      await Promise.all([
        this.prisma.db.inventoryTransaction.findMany({
          where: { organizationId, createdAt: { gte: todayStart } },
          include: { item: { select: { sellingPrice: true, costPrice: true } } },
        }),
        this.prisma.db.inventoryTransaction.findMany({
          where: { organizationId, createdAt: { gte: yesterdayStart, lt: todayStart } },
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
        this.prisma.db.checklistItem.count({
          where: { note: { organizationId }, isCompleted: false },
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

    let yesterdaySalesCount = 0;
    for (const tx of yesterdayTransactions) {
      if (tx.type === 'SALE') {
        yesterdaySalesCount += Math.abs(Number(tx.quantityChange));
      }
    }

    let todaySalesTrend = 0;
    if (yesterdaySalesCount === 0 && todaySalesCount > 0) {
      todaySalesTrend = 100;
    } else if (yesterdaySalesCount > 0) {
      todaySalesTrend = Math.round(((todaySalesCount - yesterdaySalesCount) / yesterdaySalesCount) * 100);
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
        unit: item.unit,
      }));

    const categoryCount = new Set(allItems.map(i => i.category || 'Other')).size;

    return {
      greeting: { timeOfDay: now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening' },
      kpis: {
        todaySalesCount,
        todaySalesTrend,
        todaySalesTrendLabel: todaySalesTrend > 0 ? `+${todaySalesTrend}% vs yesterday` : todaySalesTrend < 0 ? `${todaySalesTrend}% vs yesterday` : 'Same as yesterday',
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
      })),
      lowStockWatchList: topLowStockItems,
      recommendedActions: actions,
    };
  }

  // ── EAT Day Boundary Helper ────────────────────────────────────────────────
  // Returns UTC-stored Date boundaries for a given EAT (UTC+3) calendar day.
  // offsetDays=0 = today in Nairobi, 1 = tomorrow, -1 = yesterday, etc.
  private getEATDayBounds(offsetDays = 0): { start: Date; end: Date } {
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowEAT = new Date(Date.now() + EAT_OFFSET_MS);
    // Midnight of the target EAT calendar day, expressed as a UTC timestamp
    const startUTC = new Date(
      Date.UTC(
        nowEAT.getUTCFullYear(),
        nowEAT.getUTCMonth(),
        nowEAT.getUTCDate() + offsetDays,
      ) - EAT_OFFSET_MS,
    );
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    return { start: startUTC, end: endUTC };
  }

  // ── Guest House Dashboard ──────────────────────────────────────────────────
  async getGuestHouseDashboard(organizationId: string) {
    const todayBounds = this.getEATDayBounds(0);
    const tomorrowBounds = this.getEATDayBounds(1);

    // Month-to-date window in EAT
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowEAT = new Date(Date.now() + EAT_OFFSET_MS);
    const monthStartUTC = new Date(
      Date.UTC(nowEAT.getUTCFullYear(), nowEAT.getUTCMonth(), 1) - EAT_OFFSET_MS,
    );
    const nextMonthStartUTC = new Date(
      Date.UTC(nowEAT.getUTCFullYear(), nowEAT.getUTCMonth() + 1, 1) - EAT_OFFSET_MS,
    );
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      rooms,
      checkedInCount,
      overdueBookings,
      todayBookings,
      tomorrowBookings,
      settledInvoices,
      openInvoices,
      consumptionTx,
      fastMovingTx,
      allItems,
    ] = await Promise.all([
      // All active rooms (for total room count)
      this.prisma.db.room.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, status: true },
      }),

      // Count of currently checked-in bookings
      this.prisma.db.booking.count({
        where: { organizationId, status: 'CHECKED_IN' },
      }),

      // Overdue: still CHECKED_IN but checkout date is before today (EAT)
      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: 'CHECKED_IN',
          checkOutDate: { lt: todayBounds.start },
        },
        include: { guest: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),

      // Departing today (EAT calendar day)
      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: 'CHECKED_IN',
          checkOutDate: { gte: todayBounds.start, lt: todayBounds.end },
        },
        include: { guest: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),

      // Departing tomorrow (EAT calendar day)
      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: 'CHECKED_IN',
          checkOutDate: { gte: tomorrowBounds.start, lt: tomorrowBounds.end },
        },
        include: { guest: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),

      // Revenue: invoices whose booking actualCheckOut falls this month (checkout-anchored)
      this.prisma.db.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['PAID', 'PARTIAL'] },
          booking: { actualCheckOut: { gte: monthStartUTC, lt: nextMonthStartUTC } },
        },
        select: { amountPaid: true },
      }),

      // Outstanding: open invoices (DRAFT, ISSUED, PARTIAL)
      // grandTotal = roomTotal + consumptionTotal + adjustmentsTotal (no stored column — plan v3.2 Issue 3)
      this.prisma.db.invoice.findMany({
        where: { organizationId, status: { notIn: ['PAID', 'VOIDED'] } },
        select: { roomTotal: true, consumptionTotal: true, adjustmentsTotal: true, amountPaid: true },
      }),

      // Cost: booking-linked SALE/WASTAGE where that booking checked out this month
      // quantityChange is negative for these types — ABS() required (plan v3.2 Issue 2)
      this.prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId,
          type: { in: ['SALE', 'WASTAGE'] },
          bookingId: { not: null },
          booking: { actualCheckOut: { gte: monthStartUTC, lt: nextMonthStartUTC } },
        },
        select: { quantityChange: true, item: { select: { costPrice: true } } },
      }),

      // Fast moving: ALL SALE+WASTAGE in last 7 days, no bookingId filter
      // Intentionally unscoped — answers "what's moving overall" (plan v3.2 Issue 4)
      this.prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId,
          type: { in: ['SALE', 'WASTAGE'] },
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          itemId: true,
          quantityChange: true,
          item: { select: { name: true, unit: true, quantity: true } },
        },
      }),

      // All active items for low-stock calculation
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, unit: true, quantity: true, reorderThreshold: true },
      }),
    ]);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalRooms = rooms.length;
    const occupiedRooms = checkedInCount;
    // Zero-guard: returns 0 (not NaN) for new orgs with no rooms yet (plan v3.2 Issue 1)
    const occupancyRate = totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100);

    const revenueThisMonth = settledInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountPaid), 0,
    );

    // ABS() because SALE/WASTAGE store quantityChange as negative (confirmed sign convention)
    const costThisMonth = consumptionTx.reduce(
      (sum, tx) => sum + Math.abs(Number(tx.quantityChange)) * Number(tx.item.costPrice ?? 0), 0,
    );

    const profitThisMonth = revenueThisMonth - costThisMonth;

    // grandTotal computed inline — no stored column
    const outstandingBalance = openInvoices.reduce((sum, inv) => {
      const grandTotal =
        Number(inv.roomTotal) + Number(inv.consumptionTotal) + Number(inv.adjustmentsTotal);
      return sum + Math.max(0, grandTotal - Number(inv.amountPaid));
    }, 0);

    // ── Fast Moving (top 5 by volume consumed, last 7 days) ──────────────────
    const fastMovingMap = new Map<string, { name: string; unit: string; currentQty: number; totalConsumed: number }>();
    for (const tx of fastMovingTx) {
      const consumed = Math.abs(Number(tx.quantityChange));
      const existing = fastMovingMap.get(tx.itemId);
      if (existing) {
        existing.totalConsumed += consumed;
      } else {
        fastMovingMap.set(tx.itemId, {
          name: tx.item.name,
          unit: tx.item.unit,
          currentQty: Number(tx.item.quantity),
          totalConsumed: consumed,
        });
      }
    }
    const fastMovingStock = [...fastMovingMap.entries()]
      .sort((a, b) => b[1].totalConsumed - a[1].totalConsumed)
      .slice(0, 5)
      .map(([itemId, v]) => ({ itemId, ...v }));

    // ── Low Stock ─────────────────────────────────────────────────────────────
    const lowStockItems = allItems
      .filter(
        (i) => Number(i.reorderThreshold) > 0 && Number(i.quantity) <= Number(i.reorderThreshold),
      )
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .map((i) => ({
        itemId: i.id,
        name: i.name,
        unit: i.unit,
        quantity: Number(i.quantity),
        reorderThreshold: Number(i.reorderThreshold),
      }));

    // ── Shape departure summaries ─────────────────────────────────────────────
    type BookingRow = typeof overdueBookings[0];
    const mapBooking = (b: BookingRow) => ({
      id: b.id,
      guestName: b.guest.name,
      roomName: b.room.name,
      checkOutDate: b.checkOutDate,
    });

    return {
      occupiedRooms,
      totalRooms,
      occupancyRate,
      revenueThisMonth,
      costThisMonth,
      profitThisMonth,
      outstandingBalance,
      departureAlerts: {
        overdue: overdueBookings.map(mapBooking),
        today: todayBookings.map(mapBooking),
        tomorrow: tomorrowBookings.map(mapBooking),
      },
      fastMovingStock,
      lowStockItems,
    };
  }

  // ── School Dashboard ──────────────────────────────────────────────────────
  async getSchoolDashboard(organizationId: string) {
    const now = new Date();
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowEAT = new Date(Date.now() + EAT_OFFSET_MS);
    const monthStartUTC = new Date(
      Date.UTC(nowEAT.getUTCFullYear(), nowEAT.getUTCMonth(), 1) - EAT_OFFSET_MS,
    );

    const [
      totalStudents,
      totalClasses,
      activeTerm,
      invoices,
      overdueInvoices,
      recentPayments,
    ] = await Promise.all([
      this.prisma.db.student.count({ where: { organizationId, isActive: true } }),
      this.prisma.db.schoolClass.count({ where: { organizationId, isActive: true } }),
      this.prisma.db.academicTerm.findFirst({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, dueDate: true },
      }),
      this.prisma.db.feeInvoice.findMany({
        where: { organizationId, status: { not: 'VOIDED' } },
        select: { totalExpected: true, adjustmentsTotal: true, amountPaid: true, status: true },
      }),
      this.prisma.db.feeInvoice.findMany({
        where: { organizationId, status: { in: ['ISSUED', 'PARTIAL'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          student: { select: { name: true } },
          term: { select: { name: true } },
        },
      }),
      this.prisma.db.feePayment.findMany({
        where: { invoice: { organizationId }, recordedAt: { gte: monthStartUTC } },
        orderBy: { recordedAt: 'desc' },
        take: 5,
        include: {
          invoice: {
            include: { student: { select: { name: true } } },
          },
        },
      }),
    ]);

    const totalExpected = invoices.reduce(
      (s, i) => s + Number(i.totalExpected) - Number(i.adjustmentsTotal), 0,
    );
    const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const outstanding = Math.max(0, totalExpected - totalCollected);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    const paidCount = invoices.filter(i => i.status === 'PAID').length;
    const totalInvoices = invoices.length;

    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    return {
      timeOfDay,
      totalStudents,
      totalClasses,
      activeTerm: activeTerm ? { name: activeTerm.name, dueDate: activeTerm.dueDate } : null,
      fees: { totalExpected, totalCollected, outstanding, collectionRate, paidCount, totalInvoices },
      overdueInvoices: overdueInvoices.map(inv => ({
        id: inv.id,
        studentName: inv.student.name,
        termName: inv.term.name,
        amountDue: Number(inv.totalExpected) - Number(inv.adjustmentsTotal) - Number(inv.amountPaid),
        status: inv.status,
      })),
      recentPayments: recentPayments
        .filter(p => p.invoice)
        .map(p => ({
          id: p.id,
          studentName: p.invoice!.student.name,
          amount: Number(p.amount),
          method: p.method,
          recordedAt: p.recordedAt,
        })),
    };
  }

  // ── Chemist Dashboard ──────────────────────────────────────────────────────
  async getChemistDashboard(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowEAT = new Date(Date.now() + EAT_OFFSET_MS);
    const monthStartUTC = new Date(
      Date.UTC(nowEAT.getUTCFullYear(), nowEAT.getUTCMonth(), 1) - EAT_OFFSET_MS,
    );

    const [
      todayTx,
      monthTx,
      allItems,
      expiringBatches,
      expiredBatches,
      fastMovingTx,
      activeAlerts,
    ] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true } } },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: monthStartUTC } },
        include: { item: { select: { sellingPrice: true } } },
      }),
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, unit: true, quantity: true, reorderThreshold: true },
      }),
      this.prisma.db.stockBatch.findMany({
        where: { organizationId, quantity: { gt: 0 }, expiryDate: { lte: in90Days, gt: in30Days } },
        include: { inventoryItem: { select: { name: true } } },
        orderBy: { expiryDate: 'asc' },
        take: 10,
      }),
      this.prisma.db.stockBatch.findMany({
        where: { organizationId, quantity: { gt: 0 }, expiryDate: { lte: in30Days } },
        include: { inventoryItem: { select: { name: true } } },
        orderBy: { expiryDate: 'asc' },
        take: 10,
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: sevenDaysAgo } },
        select: { itemId: true, quantityChange: true, item: { select: { name: true, unit: true } } },
      }),
      this.prisma.db.alert.findMany({
        where: { organizationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const todaySales = todayTx.reduce(
      (s, tx) => s + Math.abs(Number(tx.quantityChange)) * Number(tx.item.sellingPrice ?? 0), 0,
    );
    const monthSales = monthTx.reduce(
      (s, tx) => s + Math.abs(Number(tx.quantityChange)) * Number(tx.item.sellingPrice ?? 0), 0,
    );
    const lowStockCount = allItems.filter(
      i => Number(i.reorderThreshold) > 0 && Number(i.quantity) <= Number(i.reorderThreshold),
    ).length;

    const fastMovingMap = new Map<string, { name: string; unit: string; totalSold: number }>();
    for (const tx of fastMovingTx) {
      const sold = Math.abs(Number(tx.quantityChange));
      const ex = fastMovingMap.get(tx.itemId);
      if (ex) { ex.totalSold += sold; }
      else { fastMovingMap.set(tx.itemId, { name: tx.item.name, unit: tx.item.unit, totalSold: sold }); }
    }
    const topSellers = [...fastMovingMap.entries()]
      .sort((a, b) => b[1].totalSold - a[1].totalSold)
      .slice(0, 5)
      .map(([itemId, v]) => ({ itemId, ...v }));

    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    return {
      timeOfDay,
      todaySales,
      monthSales,
      lowStockCount,
      totalItems: allItems.length,
      expiringBatches: expiringBatches.map(b => ({
        id: b.id,
        productName: b.inventoryItem.name,
        quantity: Number(b.quantity),
        expiryDate: b.expiryDate,
        daysLeft: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      expiredBatches: expiredBatches.map(b => ({
        id: b.id,
        productName: b.inventoryItem.name,
        quantity: Number(b.quantity),
        expiryDate: b.expiryDate,
        daysLeft: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      topSellers,
      alerts: activeAlerts.map(a => ({ id: a.id, message: a.title, severity: a.severity })),
    };
  }

  // ── Restaurant Dashboard ───────────────────────────────────────────────────
  async getRestaurantDashboard(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      openOrders,
      paidOrders,
      todayTx,
      topComposites,
      activeAlerts,
    ] = await Promise.all([
      this.prisma.db.tableOrder.findMany({
        where: { organizationId, status: 'OPEN' },
        include: { items: { include: { item: { select: { name: true, sellingPrice: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.tableOrder.count({
        where: { organizationId, status: 'PAID', createdAt: { gte: todayStart } },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
      this.prisma.db.inventoryTransaction.groupBy({
        by: ['itemId'],
        where: { organizationId, type: 'SALE', createdAt: { gte: sevenDaysAgo } },
        _sum: { quantityChange: true },
        orderBy: { _sum: { quantityChange: 'asc' } },
        take: 5,
      }),
      this.prisma.db.alert.findMany({
        where: { organizationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const todayRevenue = todayTx.reduce(
      (s, tx) => s + Math.abs(Number(tx.quantityChange)) * Number(tx.item.sellingPrice ?? 0), 0,
    );
    const openOrdersCount = openOrders.length;
    const openOrdersValue = openOrders.reduce((s, ord) =>
      s + ord.items.reduce((si, item) =>
        si + Number(item.quantity) * Number(item.item.sellingPrice ?? 0), 0), 0,
    );

    const topMenuItems = await Promise.all(
      topComposites.map(async g => {
        const item = await this.prisma.db.inventoryItem.findUnique({
          where: { id: g.itemId },
          select: { name: true, unit: true },
        });
        return {
          itemId: g.itemId,
          name: item?.name ?? 'Unknown',
          unit: item?.unit ?? '',
          totalSold: Math.abs(Number(g._sum.quantityChange ?? 0)),
        };
      }),
    );

    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    return {
      timeOfDay,
      todayRevenue,
      openOrdersCount,
      openOrdersValue,
      paidOrdersToday: paidOrders,
      openOrders: openOrders.map(ord => ({
        id: ord.id,
        tableLabel: ord.tableLabel,
        itemCount: ord.items.length,
        orderValue: ord.items.reduce((s, i) => s + Number(i.quantity) * Number(i.item.sellingPrice ?? 0), 0),
        createdAt: ord.createdAt,
      })),
      topMenuItems,
      alerts: activeAlerts.map(a => ({ id: a.id, message: a.title, severity: a.severity })),
    };
  }

  // ── Wholesale Dashboard ────────────────────────────────────────────────────
  async getWholesaleDashboard(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowEAT = new Date(Date.now() + EAT_OFFSET_MS);
    const monthStartUTC = new Date(
      Date.UTC(nowEAT.getUTCFullYear(), nowEAT.getUTCMonth(), 1) - EAT_OFFSET_MS,
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayTx,
      monthTx,
      openCredits,
      allItems,
      topSellersTx,
      activeAlerts,
    ] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true } } },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: monthStartUTC } },
        include: { item: { select: { sellingPrice: true } } },
      }),
      this.prisma.db.creditRecord.findMany({
        where: { organizationId, status: { in: ['UNPAID', 'PARTIAL'] } },
        orderBy: { amountTotal: 'desc' },
        take: 5,
      }),
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, unit: true, quantity: true, reorderThreshold: true },
      }),
      this.prisma.db.inventoryTransaction.groupBy({
        by: ['itemId'],
        where: { organizationId, type: 'SALE', createdAt: { gte: sevenDaysAgo } },
        _sum: { quantityChange: true },
        orderBy: { _sum: { quantityChange: 'asc' } },
        take: 5,
      }),
      this.prisma.db.alert.findMany({
        where: { organizationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const todaySales = todayTx.reduce(
      (s, tx) => s + Math.abs(Number(tx.quantityChange)) * Number(tx.item.sellingPrice ?? 0), 0,
    );
    const monthSales = monthTx.reduce(
      (s, tx) => s + Math.abs(Number(tx.quantityChange)) * Number(tx.item.sellingPrice ?? 0), 0,
    );
    const totalOutstanding = openCredits.reduce((s, c) => s + Number(c.amountTotal) - Number(c.amountPaid), 0);
    const lowStockCount = allItems.filter(
      i => Number(i.reorderThreshold) > 0 && Number(i.quantity) <= Number(i.reorderThreshold),
    ).length;

    const topSellers = await Promise.all(
      topSellersTx.map(async g => {
        const item = await this.prisma.db.inventoryItem.findUnique({
          where: { id: g.itemId },
          select: { name: true, unit: true },
        });
        return {
          itemId: g.itemId,
          name: item?.name ?? 'Unknown',
          unit: item?.unit ?? '',
          totalSold: Math.abs(Number(g._sum.quantityChange ?? 0)),
        };
      }),
    );

    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    return {
      timeOfDay,
      todaySales,
      monthSales,
      totalOutstanding,
      openCreditCount: openCredits.length,
      lowStockCount,
      totalItems: allItems.length,
      topDebtors: openCredits.map(c => ({
        id: c.id,
        clientName: c.clientName,
        amountOwed: Number(c.amountTotal) - Number(c.amountPaid),
        status: c.status,
      })),
      topSellers,
      alerts: activeAlerts.map(a => ({ id: a.id, message: a.title, severity: a.severity })),
    };
  }

  // ── Recommended Actions (AI) ───────────────────────────────────────────────
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
