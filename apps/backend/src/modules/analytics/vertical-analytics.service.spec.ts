import { PrismaService } from '../../infrastructure/prisma.service';
import { VerticalAnalyticsService } from './vertical-analytics.service';

const ORG = 'org_a';

function build() {
  const db: any = {
    room: { findMany: jest.fn(async () => []) },
    booking: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    invoice: { findMany: jest.fn(async () => []) },
    inventoryTransaction: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    inventoryItem: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    student: { count: jest.fn(async () => 0) },
    schoolClass: { count: jest.fn(async () => 0) },
    academicTerm: { findFirst: jest.fn(async () => null) },
    feeInvoice: { findMany: jest.fn(async () => []) },
    feePayment: { findMany: jest.fn(async () => []) },
    stockBatch: { findMany: jest.fn(async () => []) },
    alert: { findMany: jest.fn(async () => []) },
    tableOrder: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    creditRecord: { findMany: jest.fn(async () => []) },
  };
  const service = new VerticalAnalyticsService({ db } as unknown as PrismaService);
  return { service, db };
}

describe('VerticalAnalyticsService', () => {
  describe('getGuestHouseDashboard', () => {
    it('computes occupancy, revenue/cost/profit, outstanding and alerts', async () => {
      const { service, db } = build();
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      db.room.findMany.mockResolvedValue([
        { id: 'r1', status: 'OCCUPIED' },
        { id: 'r2', status: 'VACANT_CLEAN' },
      ]);
      db.booking.count.mockResolvedValue(1);
      db.booking.findMany
        .mockResolvedValueOnce([
          { id: 'b1', guest: { name: 'Jane' }, room: { name: 'R1' }, checkOutDate: future },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      db.invoice.findMany
        .mockResolvedValueOnce([{ amountPaid: 5000 }, { amountPaid: 3000 }])
        .mockResolvedValueOnce([
          { roomTotal: 1000, consumptionTotal: 0, adjustmentsTotal: 0, amountPaid: 200 },
        ]);
      db.inventoryTransaction.findMany
        .mockResolvedValueOnce([{ quantityChange: -2, item: { costPrice: 100 } }])
        .mockResolvedValueOnce([
          { itemId: 'i1', quantityChange: -5, item: { name: 'Soda', unit: 'btl', quantity: 10 } },
        ]);
      db.inventoryItem.findMany.mockResolvedValue([
        { id: 'i1', name: 'Soda', unit: 'btl', quantity: 10, reorderThreshold: 20 },
        { id: 'i2', name: 'Beer', unit: 'btl', quantity: 50, reorderThreshold: 10 },
      ]);

      const result = await service.getGuestHouseDashboard(ORG);

      expect(result.occupiedRooms).toBe(1);
      expect(result.totalRooms).toBe(2);
      expect(result.occupancyRate).toBe(50);
      expect(result.revenueThisMonth).toBe(8000);
      expect(result.costThisMonth).toBe(200);
      expect(result.profitThisMonth).toBe(7800);
      expect(result.outstandingBalance).toBe(800);
      expect(result.departureAlerts.overdue).toEqual([
        { id: 'b1', guestName: 'Jane', roomName: 'R1', checkOutDate: future },
      ]);
      expect(result.fastMovingStock).toEqual([
        { itemId: 'i1', name: 'Soda', unit: 'btl', currentQty: 10, totalConsumed: 5 },
      ]);
      expect(result.lowStockItems).toEqual([
        { itemId: 'i1', name: 'Soda', unit: 'btl', quantity: 10, reorderThreshold: 20 },
      ]);
      expect(db.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG }) }),
      );
    });
  });

  describe('getSchoolDashboard', () => {
    it('computes fee collection totals and departure of invoices/payments', async () => {
      const { service, db } = build();
      const recordedAt = new Date();
      db.student.count.mockResolvedValue(20);
      db.schoolClass.count.mockResolvedValue(3);
      db.academicTerm.findFirst.mockResolvedValue({ id: 't1', name: 'Term 1', dueDate: null });
      db.feeInvoice.findMany
        .mockResolvedValueOnce([
          { totalExpected: 1000, adjustmentsTotal: 0, amountPaid: 400, status: 'PARTIAL' },
          { totalExpected: 500, adjustmentsTotal: 0, amountPaid: 500, status: 'PAID' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'fi1',
            totalExpected: 1000,
            adjustmentsTotal: 0,
            amountPaid: 400,
            status: 'PARTIAL',
            student: { name: 'Alice' },
            term: { name: 'Term 1' },
          },
        ]);
      db.feePayment.findMany.mockResolvedValue([
        {
          id: 'p1',
          amount: 400,
          method: 'MPESA',
          recordedAt,
          invoice: { student: { name: 'Alice' } },
        },
      ]);

      const result = await service.getSchoolDashboard(ORG);

      expect(result.totalStudents).toBe(20);
      expect(result.totalClasses).toBe(3);
      expect(result.activeTerm).toEqual({ name: 'Term 1', dueDate: null });
      expect(result.fees).toEqual({
        totalExpected: 1500,
        totalCollected: 900,
        outstanding: 600,
        collectionRate: 60,
        paidCount: 1,
        totalInvoices: 2,
      });
      expect(result.overdueInvoices).toEqual([
        { id: 'fi1', studentName: 'Alice', termName: 'Term 1', amountDue: 600, status: 'PARTIAL' },
      ]);
      expect(result.recentPayments).toEqual([
        { id: 'p1', studentName: 'Alice', amount: 400, method: 'MPESA', recordedAt },
      ]);
    });
  });

  describe('getChemistDashboard', () => {
    it('splits expiring vs expired batches and totals sales', async () => {
      const { service, db } = build();
      const expiringDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
      db.inventoryTransaction.findMany
        .mockResolvedValueOnce([{ quantityChange: -2, item: { sellingPrice: 100 } }])
        .mockResolvedValueOnce([{ quantityChange: -10, item: { sellingPrice: 100 } }])
        .mockResolvedValueOnce([
          { itemId: 'i1', quantityChange: -5, item: { name: 'Panadol', unit: 'strip' } },
        ]);
      db.inventoryItem.findMany.mockResolvedValue([
        { id: 'i1', name: 'Panadol', unit: 'strip', quantity: 2, reorderThreshold: 5 },
      ]);
      db.stockBatch.findMany
        .mockResolvedValueOnce([
          {
            id: 'sb1',
            quantity: 10,
            expiryDate: expiringDate,
            inventoryItem: { name: 'Panadol' },
          },
        ])
        .mockResolvedValueOnce([]);
      db.alert.findMany.mockResolvedValue([{ id: 'a1', title: 'Low stock', severity: 'WARNING' }]);

      const result = await service.getChemistDashboard(ORG);

      expect(result.todaySales).toBe(200);
      expect(result.monthSales).toBe(1000);
      expect(result.lowStockCount).toBe(1);
      expect(result.totalItems).toBe(1);
      expect(result.expiringBatches).toHaveLength(1);
      expect(result.expiringBatches[0]).toMatchObject({ id: 'sb1', productName: 'Panadol', quantity: 10 });
      expect(result.expiredBatches).toEqual([]);
      expect(result.topSellers).toEqual([{ itemId: 'i1', name: 'Panadol', unit: 'strip', totalSold: 5 }]);
      expect(result.alerts).toEqual([{ id: 'a1', message: 'Low stock', severity: 'WARNING' }]);
    });
  });

  describe('getRestaurantDashboard', () => {
    it('computes open-order value, revenue and top menu items', async () => {
      const { service, db } = build();
      const createdAt = new Date();
      db.tableOrder.findMany.mockResolvedValue([
        {
          id: 'ord1',
          tableLabel: 'Table 4',
          createdAt,
          items: [{ quantity: 2, item: { name: 'Pizza', sellingPrice: 100 } }],
        },
      ]);
      db.tableOrder.count.mockResolvedValue(3);
      db.inventoryTransaction.findMany.mockResolvedValueOnce([
        { quantityChange: -2, item: { sellingPrice: 100, isComposite: true } },
      ]);
      db.inventoryTransaction.groupBy.mockResolvedValue([
        { itemId: 'i1', _sum: { quantityChange: -5 } },
      ]);
      db.inventoryItem.findUnique.mockResolvedValue({ name: 'Pizza', unit: 'plate' });
      db.alert.findMany.mockResolvedValue([]);

      const result = await service.getRestaurantDashboard(ORG);

      expect(result.todayRevenue).toBe(200);
      expect(result.openOrdersCount).toBe(1);
      expect(result.openOrdersValue).toBe(200);
      expect(result.paidOrdersToday).toBe(3);
      expect(result.openOrders[0]).toMatchObject({ id: 'ord1', tableLabel: 'Table 4', itemCount: 1, orderValue: 200 });
      expect(result.topMenuItems).toEqual([
        { itemId: 'i1', name: 'Pizza', unit: 'plate', totalSold: 5 },
      ]);
    });
  });

  describe('getWholesaleDashboard', () => {
    it('computes sales, outstanding credit and top debtors', async () => {
      const { service, db } = build();
      db.inventoryTransaction.findMany
        .mockResolvedValueOnce([{ quantityChange: -2, item: { sellingPrice: 100 } }])
        .mockResolvedValueOnce([{ quantityChange: -10, item: { sellingPrice: 100 } }]);
      db.creditRecord.findMany.mockResolvedValue([
        { id: 'c1', clientName: 'Shop A', amountTotal: 1000, amountPaid: 400, status: 'PARTIAL' },
      ]);
      db.inventoryItem.findMany.mockResolvedValue([
        { id: 'i1', name: 'Sugar', unit: 'sack', quantity: 1, reorderThreshold: 5 },
      ]);
      db.inventoryTransaction.groupBy.mockResolvedValue([
        { itemId: 'i1', _sum: { quantityChange: -8 } },
      ]);
      db.inventoryItem.findUnique.mockResolvedValue({ name: 'Sugar', unit: 'sack' });
      db.alert.findMany.mockResolvedValue([]);

      const result = await service.getWholesaleDashboard(ORG);

      expect(result.todaySales).toBe(200);
      expect(result.monthSales).toBe(1000);
      expect(result.totalOutstanding).toBe(600);
      expect(result.openCreditCount).toBe(1);
      expect(result.lowStockCount).toBe(1);
      expect(result.totalItems).toBe(1);
      expect(result.topDebtors).toEqual([
        { id: 'c1', clientName: 'Shop A', amountOwed: 600, status: 'PARTIAL' },
      ]);
      expect(result.topSellers).toEqual([
        { itemId: 'i1', name: 'Sugar', unit: 'sack', totalSold: 8 },
      ]);
    });
  });
});
