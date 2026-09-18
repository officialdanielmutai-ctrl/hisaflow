import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class VerticalAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
      // grandTotal = roomTotal + consumptionTotal + adjustmentsTotal (no stored column)
      this.prisma.db.invoice.findMany({
        where: { organizationId, status: { notIn: ['PAID', 'VOIDED'] } },
        select: { roomTotal: true, consumptionTotal: true, adjustmentsTotal: true, amountPaid: true },
      }),

      // Cost: booking-linked SALE/WASTAGE where that booking checked out this month
      // quantityChange is negative for these types — ABS() required
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
    const occupancyRate = totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100);

    const revenueThisMonth = settledInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountPaid), 0,
    );

    const costThisMonth = consumptionTx.reduce(
      (sum, tx) => sum + Math.abs(Number(tx.quantityChange)) * Number(tx.item.costPrice ?? 0), 0,
    );

    const profitThisMonth = revenueThisMonth - costThisMonth;

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
}
