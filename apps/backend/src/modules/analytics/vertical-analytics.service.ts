import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { inventoryDisplayName } from '../inventory/inventory-display-name';
import {
  buildZeroFilledSeries,
  computePeriodComparison,
  eatDayBounds,
  eatMonthBounds,
  eatTimeOfDay,
  effectiveTransactionSaleAmount,
  resolveAnalyticsRange,
  roundMoney,
} from './time-buckets';

@Injectable()
export class VerticalAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private getEATDayBounds(offsetDays = 0): { start: Date; end: Date } {
    return eatDayBounds(offsetDays);
  }

  // ── Guest House Dashboard ──────────────────────────────────────────────────
  async getGuestHouseDashboard(organizationId: string) {
    const now = new Date();
    const todayBounds = this.getEATDayBounds(0);
    const tomorrowBounds = this.getEATDayBounds(1);
    const { start: monthStartUTC, end: nextMonthStartUTC } = eatMonthBounds(0, now);
    const { start: prevMonthStartUTC, end: prevMonthEndUTC } = eatMonthBounds(-1, now);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);
    const sevenDaysAgo = sevenDayWindow.start;

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
      recentBookingsForSeries,
      recentPayments,
    ] = await Promise.all([
      this.prisma.db.room.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, status: true },
      }),

      this.prisma.db.booking.count({
        where: { organizationId, status: 'CHECKED_IN' },
      }),

      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: 'CHECKED_IN',
          checkOutDate: { lt: todayBounds.start },
        },
        include: { guest: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),

      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: 'CHECKED_IN',
          checkOutDate: { gte: todayBounds.start, lt: todayBounds.end },
        },
        include: { guest: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),

      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: 'CHECKED_IN',
          checkOutDate: { gte: tomorrowBounds.start, lt: tomorrowBounds.end },
        },
        include: { guest: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),

      this.prisma.db.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['PAID', 'PARTIAL'] },
          booking: { actualCheckOut: { gte: monthStartUTC, lt: nextMonthStartUTC } },
        },
        select: { amountPaid: true },
      }),

      this.prisma.db.invoice.findMany({
        where: { organizationId, status: { notIn: ['PAID', 'VOIDED'] } },
        select: { roomTotal: true, consumptionTotal: true, adjustmentsTotal: true, amountPaid: true },
      }),

      this.prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId,
          type: { in: ['SALE', 'WASTAGE'] },
          bookingId: { not: null },
          booking: { actualCheckOut: { gte: monthStartUTC, lt: nextMonthStartUTC } },
        },
        select: { quantityChange: true, item: { select: { costPrice: true } } },
      }),

      this.prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId,
          type: { in: ['SALE', 'WASTAGE'] },
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          itemId: true,
          quantityChange: true,
          item: {
            select: {
              name: true,
              unit: true,
              quantity: true,
              product: { select: { name: true } },
            },
          },
        },
      }),

      this.prisma.db.inventoryItem.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          unit: true,
          quantity: true,
          reorderThreshold: true,
          product: { select: { name: true } },
        },
      }),

      this.prisma.db.booking.findMany({
        where: {
          organizationId,
          status: { not: 'CANCELLED' },
          checkInDate: { lt: sevenDayWindow.end },
          checkOutDate: { gt: sevenDayWindow.start },
        },
        select: { id: true, roomId: true, checkInDate: true, checkOutDate: true, status: true },
      }),

      this.prisma.db.payment
        ? this.prisma.db.payment.findMany({
            where: {
              invoice: {
                organizationId,
                bookingId: { not: null },
                status: { not: 'VOIDED' },
              },
              recordedAt: { gte: prevMonthStartUTC, lt: nextMonthStartUTC },
            },
            select: { amount: true, recordedAt: true },
          })
        : Promise.resolve([]),
    ]);

    // ── KPIs (exclude out-of-service MAINTENANCE rooms from capacity) ────────
    const operationalRooms = rooms.filter((r) => r.status !== 'MAINTENANCE');
    const totalRooms = operationalRooms.length;
    const occupiedRooms = checkedInCount;
    const occupancyRate =
      totalRooms === 0 ? 0 : Math.min(100, Math.round((occupiedRooms / totalRooms) * 100));

    const invoiceSettledRev = roundMoney(
      settledInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0),
    );
    const paymentsThisMonth = roundMoney(
      recentPayments
        .filter((p) => p.recordedAt >= monthStartUTC && p.recordedAt < nextMonthStartUTC)
        .reduce((sum, p) => sum + Number(p.amount), 0),
    );
    const paymentsPrevMonth = roundMoney(
      recentPayments
        .filter((p) => p.recordedAt >= prevMonthStartUTC && p.recordedAt < prevMonthEndUTC)
        .reduce((sum, p) => sum + Number(p.amount), 0),
    );

    // Reconcile collected monthly revenue with payment records when present,
    // retaining checkout-invoice compatibility for tests/legacy records without Payment rows.
    const revenueThisMonth =
      paymentsThisMonth > 0 || invoiceSettledRev === 0 ? paymentsThisMonth : invoiceSettledRev;

    const costThisMonth = roundMoney(
      consumptionTx.reduce(
        (sum, tx) => sum + Math.abs(Number(tx.quantityChange)) * Number(tx.item.costPrice ?? 0),
        0,
      ),
    );

    const profitThisMonth = roundMoney(revenueThisMonth - costThisMonth);

    const outstandingBalance = roundMoney(
      openInvoices.reduce((sum, inv) => {
        const grandTotal =
          Number(inv.roomTotal) + Number(inv.consumptionTotal) + Number(inv.adjustmentsTotal);
        return sum + Math.max(0, grandTotal - Number(inv.amountPaid));
      }, 0),
    );

    const openBilledTotal = roundMoney(
      openInvoices.reduce(
        (sum, inv) =>
          sum + Number(inv.roomTotal) + Number(inv.consumptionTotal) + Number(inv.adjustmentsTotal),
        0,
      ),
    );
    const openPaidTotal = roundMoney(
      openInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0),
    );
    const totalReceivableBase = roundMoney(revenueThisMonth + outstandingBalance);
    const collectionHealthPct =
      totalReceivableBase > 0
        ? Math.round((revenueThisMonth / totalReceivableBase) * 100)
        : openBilledTotal > 0
          ? Math.round((openPaidTotal / openBilledTotal) * 100)
          : 0;

    // ── Server-Computed 7-Day EAT Daily Revenue & Occupancy Series ───────────
    const paymentEntries = recentPayments.map((p) => ({
      timestamp: new Date(p.recordedAt),
      value: Number(p.amount),
    }));
    const sevenDayRevenue = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      paymentEntries,
    ).buckets;

    const sevenDayOccupancy = sevenDayRevenue.map((bucket, idx) => {
      const dayStart = new Date(bucket.start);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const isToday = idx === sevenDayRevenue.length - 1;
      const distinctRooms = new Set<string>();
      for (const b of recentBookingsForSeries) {
        if (b.checkInDate < dayEnd && b.checkOutDate > dayStart && b.status !== 'CANCELLED') {
          distinctRooms.add(b.roomId);
        }
      }
      const roomsOccupied = isToday ? occupiedRooms : distinctRooms.size;
      const pct =
        totalRooms === 0 ? 0 : Math.min(100, Math.round((roomsOccupied / totalRooms) * 100));
      return {
        start: bucket.start,
        label: bucket.label,
        value: pct,
        count: roomsOccupied,
      };
    });

    // ── Fast Moving (top 5 by volume consumed, last 7 days) ──────────────────
    const fastMovingMap = new Map<
      string,
      { name: string; unit: string; currentQty: number; totalConsumed: number }
    >();
    for (const tx of fastMovingTx) {
      const consumed = Math.abs(Number(tx.quantityChange));
      const existing = fastMovingMap.get(tx.itemId);
      if (existing) {
        existing.totalConsumed += consumed;
      } else {
        fastMovingMap.set(tx.itemId, {
          name: inventoryDisplayName(tx.item),
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
        name: inventoryDisplayName(i),
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
      collectionHealthPct,
      revenueComparison: computePeriodComparison(
        revenueThisMonth,
        paymentsPrevMonth,
        'vs last month',
      ),
      dailySeries: {
        revenue: sevenDayRevenue,
        occupancyPct: sevenDayOccupancy,
      },
      generatedAt: now.toISOString(),
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
    const { start: monthStartUTC } = eatMonthBounds(0, now);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);
    const earliestPaymentStart = new Date(
      Math.min(monthStartUTC.getTime(), sevenDayWindow.previousStart.getTime()),
    );

    const [
      totalStudents,
      totalClasses,
      activeTerm,
      invoices,
      overdueInvoices,
      paymentsInWindow,
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
        where: { invoice: { organizationId }, recordedAt: { gte: earliestPaymentStart } },
        orderBy: { recordedAt: 'desc' },
        include: {
          invoice: {
            include: { student: { select: { name: true } } },
          },
        },
      }),
    ]);

    const totalExpected = roundMoney(
      invoices.reduce(
        (s, i) => s + Number(i.totalExpected) - Number(i.adjustmentsTotal),
        0,
      ),
    );
    const totalCollected = roundMoney(
      invoices.reduce((s, i) => s + Number(i.amountPaid), 0),
    );
    const outstanding = roundMoney(Math.max(0, totalExpected - totalCollected));
    const collectionRate =
      totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    const paidCount = invoices.filter((i) => i.status === 'PAID').length;
    const totalInvoices = invoices.length;

    const paymentEntries = paymentsInWindow.map((p) => ({
      timestamp: new Date(p.recordedAt),
      value: Number(p.amount),
    }));
    const sevenDayCollections = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      paymentEntries,
    );
    const prevSevenDayCollections = buildZeroFilledSeries(
      sevenDayWindow.previousStart,
      sevenDayWindow.previousEnd,
      'day',
      paymentEntries,
    );

    const recentPayments = paymentsInWindow
      .filter((p) => p.invoice && p.recordedAt >= monthStartUTC)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        studentName: p.invoice!.student.name,
        amount: Number(p.amount),
        method: p.method,
        recordedAt: p.recordedAt,
      }));

    return {
      timeOfDay: eatTimeOfDay(now),
      totalStudents,
      totalClasses,
      activeTerm: activeTerm ? { name: activeTerm.name, dueDate: activeTerm.dueDate } : null,
      fees: { totalExpected, totalCollected, outstanding, collectionRate, paidCount, totalInvoices },
      collectionsComparison: computePeriodComparison(
        sevenDayCollections.total,
        prevSevenDayCollections.total,
        sevenDayWindow.previousLabel,
      ),
      dailySeries: {
        collections: sevenDayCollections.buckets,
      },
      generatedAt: now.toISOString(),
      overdueInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        studentName: inv.student.name,
        termName: inv.term.name,
        amountDue: roundMoney(
          Number(inv.totalExpected) - Number(inv.adjustmentsTotal) - Number(inv.amountPaid),
        ),
        status: inv.status,
      })),
      recentPayments,
    };
  }

  // ── Chemist Dashboard ──────────────────────────────────────────────────────
  async getChemistDashboard(organizationId: string) {
    const now = new Date();
    const { start: todayStart } = this.getEATDayBounds(0);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);
    const sevenDaysAgo = sevenDayWindow.start;
    const { start: monthStartUTC } = eatMonthBounds(0, now);
    const { start: prevMonthStartUTC } = eatMonthBounds(-1, now);
    const { start: yesterdayStart, end: yesterdayEnd } = this.getEATDayBounds(-1);
    const earliestSeriesStart = new Date(
      Math.min(prevMonthStartUTC.getTime(), sevenDayWindow.start.getTime()),
    );

    const [
      todayTx,
      monthTx,
      allItems,
      expiringBatches,
      expiredBatches,
      fastMovingTx,
      activeAlerts,
      windowSeriesTx,
    ] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: monthStartUTC } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
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
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: earliestSeriesStart } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
    ]);

    const todaySales = roundMoney(
      todayTx.reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const monthSales = roundMoney(
      monthTx.reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const yesterdaySales = roundMoney(
      windowSeriesTx
        .filter((tx) => tx.createdAt && tx.createdAt >= yesterdayStart && tx.createdAt < yesterdayEnd)
        .reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const prevMonthSales = roundMoney(
      windowSeriesTx
        .filter(
          (tx) => tx.createdAt && tx.createdAt >= prevMonthStartUTC && tx.createdAt < monthStartUTC,
        )
        .reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );

    const seriesEntries = windowSeriesTx.map((tx) => ({
      timestamp: tx.createdAt ? new Date(tx.createdAt) : now,
      value: effectiveTransactionSaleAmount(tx),
    }));
    const sevenDaySales = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      seriesEntries,
    ).buckets;

    const lowStockCount = allItems.filter(
      (i) => Number(i.reorderThreshold) > 0 && Number(i.quantity) <= Number(i.reorderThreshold),
    ).length;

    const fastMovingMap = new Map<string, { name: string; unit: string; totalSold: number }>();
    for (const tx of fastMovingTx) {
      const sold = Math.abs(Number(tx.quantityChange));
      const ex = fastMovingMap.get(tx.itemId);
      if (ex) {
        ex.totalSold += sold;
      } else {
        fastMovingMap.set(tx.itemId, { name: tx.item.name, unit: tx.item.unit, totalSold: sold });
      }
    }
    const topSellers = [...fastMovingMap.entries()]
      .sort((a, b) => b[1].totalSold - a[1].totalSold)
      .slice(0, 5)
      .map(([itemId, v]) => ({ itemId, ...v }));

    return {
      timeOfDay: eatTimeOfDay(now),
      todaySales,
      monthSales,
      lowStockCount,
      totalItems: allItems.length,
      todaySalesComparison: computePeriodComparison(todaySales, yesterdaySales, 'vs yesterday'),
      monthSalesComparison: computePeriodComparison(monthSales, prevMonthSales, 'vs last month'),
      dailySeries: {
        sales: sevenDaySales,
      },
      generatedAt: now.toISOString(),
      expiringBatches: expiringBatches.map((b) => ({
        id: b.id,
        productName: b.inventoryItem.name,
        quantity: Number(b.quantity),
        expiryDate: b.expiryDate,
        daysLeft: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      expiredBatches: expiredBatches.map((b) => ({
        id: b.id,
        productName: b.inventoryItem.name,
        quantity: Number(b.quantity),
        expiryDate: b.expiryDate,
        daysLeft: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      topSellers,
      alerts: activeAlerts.map((a) => ({ id: a.id, message: a.title, severity: a.severity })),
    };
  }

  // ── Restaurant Dashboard ───────────────────────────────────────────────────
  async getRestaurantDashboard(organizationId: string) {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = this.getEATDayBounds(0);
    const { start: yesterdayStart, end: yesterdayEnd } = this.getEATDayBounds(-1);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);
    const sevenDaysAgo = sevenDayWindow.start;

    const [
      ordersInScope,
      paidOrdersTodayCount,
      todayTx,
      topComposites,
      activeAlerts,
      sevenDayCounterTx,
    ] = await Promise.all([
      this.prisma.db.tableOrder.findMany({
        where: {
          organizationId,
          OR: [
            { status: 'OPEN' },
            { status: 'PAID', closedAt: { gte: sevenDayWindow.previousStart } },
          ],
        },
        include: { items: { include: { item: { select: { name: true, sellingPrice: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.tableOrder.count({
        where: {
          organizationId,
          status: 'PAID',
          OR: [
            { closedAt: { gte: todayStart, lt: todayEnd } },
            { closedAt: null, createdAt: { gte: todayStart } },
          ],
        },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
      this.prisma.db.inventoryTransaction.groupBy({
        by: ['itemId'],
        where: {
          organizationId,
          type: 'SALE',
          createdAt: { gte: sevenDaysAgo },
          NOT: [
            { reason: { startsWith: 'Used in ' } },
            { reason: { startsWith: 'Table order ' } },
          ],
        },
        _sum: { quantityChange: true },
        orderBy: { _sum: { quantityChange: 'asc' } },
        take: 5,
      }),
      this.prisma.db.alert.findMany({
        where: { organizationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId,
          type: 'SALE',
          createdAt: { gte: sevenDayWindow.previousStart },
        },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
    ]);

    // Separate OPEN vs PAID orders cleanly (preserving test mocks where status may be omitted on OPEN items)
    const openOrders = ordersInScope.filter((o) => !o.status || o.status === 'OPEN');
    const paidOrders = ordersInScope.filter((o) => o.status === 'PAID');

    const orderRevenue = (ord: (typeof ordersInScope)[number]) =>
      roundMoney(
        ord.items.reduce(
          (si, item) =>
            si +
            Number(item.quantity) * Number((item as { unitPrice?: unknown }).unitPrice ?? item.item?.sellingPrice ?? 0),
          0,
        ),
      );

    // Revenue from paid TableOrders in [start, end) PLUS direct non-table InventoryTransaction sales
    const paidOrdersEntries = paidOrders.map((ord) => ({
      timestamp: new Date(ord.closedAt ?? ord.createdAt),
      value: orderRevenue(ord),
    }));
    const directCounterTodayRev = roundMoney(
      todayTx.reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const paidOrdersTodayRev = roundMoney(
      paidOrdersEntries
        .filter((e) => e.timestamp >= todayStart && e.timestamp < todayEnd)
        .reduce((s, e) => s + e.value, 0),
    );
    const todayRevenue = roundMoney(paidOrdersTodayRev + directCounterTodayRev);

    const directCounterSeriesEntries = sevenDayCounterTx
      .map((tx) => ({
        timestamp: tx.createdAt ? new Date(tx.createdAt) : now,
        value: effectiveTransactionSaleAmount(tx),
      }))
      .filter((e) => e.value > 0);

    const allRestaurantRevenueEntries = [...paidOrdersEntries, ...directCounterSeriesEntries];
    const yesterdayRevenue = roundMoney(
      allRestaurantRevenueEntries
        .filter((e) => e.timestamp >= yesterdayStart && e.timestamp < yesterdayEnd)
        .reduce((s, e) => s + e.value, 0),
    );

    const sevenDayRevenue = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      allRestaurantRevenueEntries,
    ).buckets;

    const sevenDayOrders = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      paidOrdersEntries.map((e) => ({ timestamp: e.timestamp, value: 1 })),
    ).buckets;

    const openOrdersCount = openOrders.length;
    const openOrdersValue = roundMoney(
      openOrders.reduce((s, ord) => s + orderRevenue(ord), 0),
    );

    const topMenuItems = await Promise.all(
      topComposites.map(async (g) => {
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

    return {
      timeOfDay: eatTimeOfDay(now),
      todayRevenue,
      openOrdersCount,
      openOrdersValue,
      paidOrdersToday: paidOrdersTodayCount,
      revenueComparison: computePeriodComparison(todayRevenue, yesterdayRevenue, 'vs yesterday'),
      dailySeries: {
        revenue: sevenDayRevenue,
        orders: sevenDayOrders,
      },
      generatedAt: now.toISOString(),
      openOrders: openOrders.map((ord) => ({
        id: ord.id,
        tableLabel: ord.tableLabel,
        itemCount: ord.items.length,
        orderValue: orderRevenue(ord),
        createdAt: ord.createdAt,
      })),
      topMenuItems,
      alerts: activeAlerts.map((a) => ({ id: a.id, message: a.title, severity: a.severity })),
    };
  }

  // ── Wholesale Dashboard ────────────────────────────────────────────────────
  async getWholesaleDashboard(organizationId: string) {
    const now = new Date();
    const { start: todayStart } = this.getEATDayBounds(0);
    const { start: yesterdayStart, end: yesterdayEnd } = this.getEATDayBounds(-1);
    const { start: monthStartUTC } = eatMonthBounds(0, now);
    const { start: prevMonthStartUTC } = eatMonthBounds(-1, now);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);
    const sevenDaysAgo = sevenDayWindow.start;
    const earliestSeriesStart = new Date(
      Math.min(prevMonthStartUTC.getTime(), sevenDayWindow.start.getTime()),
    );

    const [
      todayTx,
      monthTx,
      openCredits,
      allItems,
      topSellersTx,
      activeAlerts,
      windowSeriesTx,
    ] = await Promise.all([
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: todayStart } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: monthStartUTC } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
      // Fetch ALL open credit accounts so totalOutstanding and openCreditCount are never truncated!
      this.prisma.db.creditRecord.findMany({
        where: { organizationId, status: { in: ['UNPAID', 'PARTIAL'] } },
        orderBy: { amountTotal: 'desc' },
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
      this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, type: 'SALE', createdAt: { gte: earliestSeriesStart } },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      }),
    ]);

    const todaySales = roundMoney(
      todayTx.reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const monthSales = roundMoney(
      monthTx.reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const yesterdaySales = roundMoney(
      windowSeriesTx
        .filter((tx) => tx.createdAt && tx.createdAt >= yesterdayStart && tx.createdAt < yesterdayEnd)
        .reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );
    const prevMonthSales = roundMoney(
      windowSeriesTx
        .filter(
          (tx) => tx.createdAt && tx.createdAt >= prevMonthStartUTC && tx.createdAt < monthStartUTC,
        )
        .reduce((s, tx) => s + effectiveTransactionSaleAmount(tx), 0),
    );

    const seriesEntries = windowSeriesTx.map((tx) => ({
      timestamp: tx.createdAt ? new Date(tx.createdAt) : now,
      value: effectiveTransactionSaleAmount(tx),
    }));
    const sevenDaySales = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      seriesEntries,
    ).buckets;

    const totalOutstanding = roundMoney(
      openCredits.reduce((s, c) => s + Math.max(0, Number(c.amountTotal) - Number(c.amountPaid)), 0),
    );
    const lowStockCount = allItems.filter(
      (i) => Number(i.reorderThreshold) > 0 && Number(i.quantity) <= Number(i.reorderThreshold),
    ).length;

    const topSellers = await Promise.all(
      topSellersTx.map(async (g) => {
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

    return {
      timeOfDay: eatTimeOfDay(now),
      todaySales,
      monthSales,
      totalOutstanding,
      openCreditCount: openCredits.length,
      lowStockCount,
      totalItems: allItems.length,
      todaySalesComparison: computePeriodComparison(todaySales, yesterdaySales, 'vs yesterday'),
      monthSalesComparison: computePeriodComparison(monthSales, prevMonthSales, 'vs last month'),
      dailySeries: {
        sales: sevenDaySales,
      },
      generatedAt: now.toISOString(),
      topDebtors: openCredits.slice(0, 5).map((c) => ({
        id: c.id,
        clientName: c.clientName,
        amountOwed: roundMoney(Math.max(0, Number(c.amountTotal) - Number(c.amountPaid))),
        status: c.status,
      })),
      topSellers,
      alerts: activeAlerts.map((a) => ({ id: a.id, message: a.title, severity: a.severity })),
    };
  }
}
