import { config } from 'dotenv';
import { resolve } from 'path';

// Load the test-only environment before importing the Prisma client.
config({ path: resolve(__dirname, '..', '.env.test') });

import { mkdirSync, writeFileSync } from 'fs';
import { PrismaService } from '../src/infrastructure/prisma.service';

/**
 * Seeds a deterministic, synthetic dataset for the Duty 1 browser sweep:
 * one organisation per business type, all owned by `e2e-owner`, plus a
 * `e2e-staff` member for role-gated screens. No real customer data.
 *
 * Writes the org ids to `e2e/.auth/seed.json` so the Playwright spec can select
 * the active org (the app reads `localStorage['hf:active_org_id']`).
 *
 * Run: E2E_AUTH_BYPASS=true npx ts-node test/e2e-seed.ts
 */

const BUSINESS_TYPES = [
  'DUKA',
  'MINI_MART',
  'CHEMIST',
  'RESTAURANT',
  'SCHOOL',
  'WHOLESALER',
  'ISP',
  'GUEST_HOUSE',
] as const;

type BusinessType = (typeof BUSINESS_TYPES)[number];

const prisma = new PrismaService();
const db = prisma.db;

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(today.getTime() + n * 86_400_000);

async function truncateAll(): Promise<void> {
  await db.$executeRawUnsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `);
}

interface SeededItem {
  id: string;
  name: string;
}

/** Adversarial inventory: zero stock, low stock, long names, large prices. */
async function seedInventory(organizationId: string): Promise<SeededItem[]> {
  const specs = [
    { name: 'Unga wa Mahindi Pembe 2kg', unit: 'packet', qty: 240, buy: 120, sell: 155, low: 40 },
    { name: 'Cooking Oil 5L Jerrycan', unit: 'jerrycan', qty: 8, buy: 1150, sell: 1400, low: 12 },
    { name: 'Sugar 50kg Sack', unit: 'sack', qty: 0, buy: 6200, sell: 7350, low: 5 },
    { name: 'Premium Laundry Detergent Powder 2kg Family Pack', unit: 'packet', qty: 33, buy: 480, sell: 620, low: 10 },
    { name: 'Milk 500ml', unit: 'bottle', qty: 4, buy: 55, sell: 70, low: 24 },
    { name: 'Soda 300ml Crate of 24', unit: 'crate', qty: 51, buy: 720, sell: 960, low: 6 },
    { name: 'Maize Flour 1kg', unit: 'packet', qty: 610, buy: 68, sell: 89, low: 100 },
    { name: 'Cooking Gas 13kg Cylinder Refill', unit: 'cylinder', qty: 12, buy: 2100, sell: 2600, low: 4 },
    { name: 'Bread 400g', unit: 'loaf', qty: 2, buy: 55, sell: 65, low: 20 },
    { name: 'Bathing Soap Bar 800g', unit: 'bar', qty: 76, buy: 210, sell: 260, low: 15 },
    { name: 'Tea Leaves 500g', unit: 'packet', qty: 140, buy: 180, sell: 230, low: 30 },
    { name: 'Rice Pishori 25kg', unit: 'bag', qty: 17, buy: 3400, sell: 4100, low: 5 },
  ];

  const items: SeededItem[] = [];
  for (const spec of specs) {
    const product = await db.product.create({
      data: { organizationId, name: spec.name, category: 'General' },
    });
    const item = await db.inventoryItem.create({
      data: {
        organizationId,
        productId: product.id,
        name: spec.name,
        category: 'General',
        unit: spec.unit,
        quantity: spec.qty,
        reorderThreshold: spec.low,
        costPrice: spec.buy,
        sellingPrice: spec.sell,
        status: spec.qty <= 0 ? 'OUT_OF_STOCK' : spec.qty <= spec.low ? 'LOW' : 'HEALTHY',
      },
    });
    items.push({ id: item.id, name: item.name });
  }
  return items;
}

async function seedTransactions(
  organizationId: string,
  items: SeededItem[],
  actorId: string,
): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const item = items[i % items.length];
    const qty = (i % 7) + 1;
    const before = 500 + i;
    await db.inventoryTransaction.create({
      data: {
        organizationId,
        itemId: item.id,
        type: 'SALE',
        quantityBefore: before,
        quantityChange: -qty,
        quantityAfter: before - qty,
        reason: 'Counter sale',
        actorId,
        clientName: i % 3 === 0 ? 'Mama Mboga Retail Wholesalers Ltd' : null,
        createdAt: daysAgo(i % 20),
      },
    });
  }
  for (let i = 0; i < 12; i += 1) {
    const item = items[(i + 3) % items.length];
    const qty = (i % 5) + 10;
    const before = 100 + i * 5;
    await db.inventoryTransaction.create({
      data: {
        organizationId,
        itemId: item.id,
        type: i % 2 === 0 ? 'PURCHASE' : 'WASTAGE',
        quantityBefore: before,
        quantityChange: i % 2 === 0 ? qty : -qty,
        quantityAfter: i % 2 === 0 ? before + qty : before - qty,
        reason: i % 2 === 0 ? 'Supplier delivery' : 'Expired',
        actorId,
        createdAt: daysAgo(i),
      },
    });
  }
}

async function seedRetailLike(
  organizationId: string,
  businessType: BusinessType,
  actorId: string,
): Promise<void> {
  const items = await seedInventory(organizationId);
  await seedTransactions(organizationId, items, actorId);

  await db.businessTransaction.createMany({
    data: [
      { organizationId, type: 'EXPENSE', category: 'RENT', amount: 45000, description: 'Monthly shop rent', date: daysAgo(3) },
      { organizationId, type: 'EXPENSE', category: 'SALARY', amount: 120000, description: 'Staff salaries', staffName: 'Jane Wanjiku', date: daysAgo(5) },
      { organizationId, type: 'EXPENSE', category: 'UTILITIES', amount: 8700, description: 'Electricity token', date: daysAgo(1) },
      { organizationId, type: 'INCOME', category: 'SERVICE_FEE', amount: 25000, description: 'Delivery service income', date: daysAgo(2) },
    ],
  });

  await db.note.createMany({
    data: [
      { organizationId, authorId: actorId, title: 'Call the wholesaler about the sugar delivery that arrived short', importance: 'HIGH', status: 'OPEN', dueDate: daysAhead(2) },
      { organizationId, authorId: actorId, title: 'Pay rent', importance: 'MEDIUM', status: 'IN_PROGRESS', dueDate: daysAhead(5) },
      { organizationId, authorId: actorId, title: 'Restock low items before the weekend rush', importance: 'CRITICAL', status: 'OPEN', dueDate: daysAhead(1) },
    ],
  });

  const lowItems = items.slice(0, 3);
  for (const item of lowItems) {
    await db.alert.create({
      data: {
        organizationId,
        itemId: item.id,
        type: 'LOW_STOCK',
        severity: 'WARNING',
        title: `Low stock: ${item.name}`,
        description: `${item.name} is below its reorder threshold.`,
      },
    });
  }

  if (businessType === 'WHOLESALER') {
    const first = items[0];
    await db.packagingUnit.create({
      data: { variantId: first.id, name: 'Carton of 12', quantityPerUnit: 12, sellingPrice: 1700 },
    });
    await db.tieredPriceRule.create({
      data: { organizationId, inventoryItemId: first.id, minQuantity: 10, pricePerUnit: 145, label: 'Bulk 10+' },
    });
    await db.creditRecord.create({
      data: { organizationId, clientName: 'Mama Mboga Retail Wholesalers Ltd', amountTotal: 185000, amountPaid: 60000, status: 'PARTIAL', dueDate: daysAhead(10) },
    });
  }

  if (businessType === 'CHEMIST') {
    const medicine = items[0];
    await db.stockBatch.create({
      data: { organizationId, inventoryItemId: medicine.id, batchNumber: 'BATCH-2026-001', expiryDate: daysAhead(400), quantity: 120, costPrice: 120 },
    });
    await db.stockBatch.create({
      data: { organizationId, inventoryItemId: medicine.id, batchNumber: 'BATCH-2026-002', expiryDate: daysAgo(2), quantity: 15, costPrice: 118 },
    });
  }
}

async function seedRestaurant(organizationId: string, actorId: string): Promise<void> {
  const items = await seedInventory(organizationId);
  const menu = await db.inventoryItem.create({
    data: { organizationId, name: 'Chicken Pilau Plate', unit: 'plate', quantity: 0, sellingPrice: 450, isComposite: true, category: 'Menu' },
  });
  const ingredient = items[0];
  await db.recipeIngredient.create({
    data: { compositeItemId: menu.id, ingredientId: ingredient.id, quantityUsed: 0.25 },
  });
  const order = await db.tableOrder.create({
    data: {
      organizationId,
      tableLabel: 'Table 12',
      status: 'OPEN',
      notes: 'No onions on the second plate',
      items: {
        create: [
          { itemId: menu.id, quantity: 2, unitPrice: 450 },
          { itemId: ingredient.id, quantity: 1, unitPrice: 155 },
        ],
      },
    },
  });
  await db.tableOrder.create({
    data: {
      organizationId,
      tableLabel: 'Table 7',
      status: 'OPEN',
      items: { create: [{ itemId: menu.id, quantity: 3, unitPrice: 450 }] },
    },
  });
  void order;
  await seedTransactions(organizationId, items, actorId);
}

async function seedGuestHouse(organizationId: string, actorId: string): Promise<void> {
  const items = await seedInventory(organizationId);
  await seedTransactions(organizationId, items, actorId);

  const rooms = [
    { name: 'Room 1', type: 'Single', baseRate: 2500, status: 'OCCUPIED' as const },
    { name: 'Room 2', type: 'Double', baseRate: 3800, status: 'OCCUPIED' as const },
    { name: 'Room 3', type: 'Double', baseRate: 3800, status: 'VACANT_CLEAN' as const },
    { name: 'Executive Suite with Garden View', type: 'Suite', baseRate: 9500, status: 'VACANT_DIRTY' as const },
    { name: 'Room 5', type: 'Single', baseRate: 2500, status: 'MAINTENANCE' as const },
    { name: 'Room 6', type: 'Double', baseRate: 4200, status: 'VACANT_CLEAN' as const },
  ];
  const createdRooms: { id: string }[] = [];
  for (const room of rooms) {
    createdRooms.push(await db.room.create({ data: { organizationId, ...room } }));
  }

  const guests = [
    { name: 'John Kamau', phone: '+254712345678', email: 'john.kamau@example.test' },
    { name: 'Mary Wanjiru', phone: '+254723456789', email: 'mary.wanjiru@example.test' },
    { name: 'A Very Long Guest Name That Should Truncate Gracefully', phone: '+254734567890', email: 'long.name.customer@example.test' },
    { name: 'Peter Otieno', phone: '+254745678901' },
  ];
  const createdGuests: { id: string }[] = [];
  for (const guest of guests) {
    createdGuests.push(await db.guest.create({ data: { organizationId, ...guest } }));
  }

  const booking = await db.booking.create({
    data: {
      organizationId,
      roomId: createdRooms[0].id,
      guestId: createdGuests[0].id,
      status: 'CHECKED_IN',
      checkInDate: daysAgo(1),
      checkOutDate: daysAhead(2),
      actualCheckIn: daysAgo(1),
      ratePerNight: 2500,
      notes: 'Late check-in requested',
    },
  });
  await db.booking.create({
    data: {
      organizationId,
      roomId: createdRooms[1].id,
      guestId: createdGuests[1].id,
      status: 'RESERVED',
      checkInDate: daysAhead(1),
      checkOutDate: daysAhead(4),
      ratePerNight: 3800,
    },
  });

  const invoice = await db.invoice.create({
    data: {
      organizationId,
      bookingId: booking.id,
      status: 'PARTIAL',
      roomTotal: 7500,
      consumptionTotal: 1200,
      adjustmentsTotal: 0,
      amountPaid: 5000,
      issuedAt: daysAgo(1),
      dueDate: daysAhead(1),
      lineItems: {
        create: [
          { description: 'Room charge (3 nights)', quantity: 3, unitPrice: 2500, total: 7500 },
          { description: 'Mineral water and snacks', quantity: 4, unitPrice: 300, total: 1200 },
        ],
      },
      payments: { create: [{ amount: 5000, method: 'MPESA', note: 'Deposit' }] },
    },
  });
  void invoice;
}

async function seedSchool(organizationId: string, actorId: string): Promise<void> {
  const items = await seedInventory(organizationId);
  await seedTransactions(organizationId, items, actorId);

  const classNames = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
  const classes: { id: string }[] = [];
  for (const name of classNames) {
    classes.push(await db.schoolClass.create({ data: { organizationId, name } }));
  }

  const term = await db.academicTerm.create({
    data: {
      organizationId,
      name: 'Term 1 2026',
      startDate: daysAgo(40),
      endDate: daysAhead(50),
      dueDate: daysAhead(10),
      isActive: true,
    },
  });

  await db.feeStructure.createMany({
    data: [
      { organizationId, termId: term.id, name: 'Tuition Fee', amount: 45000 },
      { organizationId, termId: term.id, name: 'Activity Fee', amount: 3500 },
      { organizationId, termId: term.id, name: 'Exam Fee', amount: 2500 },
    ],
  });

  const firstNames = ['John', 'Mary', 'Peter', 'Grace', 'Brian', 'Aisha', 'Kevin', 'Faith'];
  const students: { id: string }[] = [];
  for (let i = 0; i < 48; i += 1) {
    const cls = classes[i % classes.length];
    students.push(
      await db.student.create({
        data: {
          organizationId,
          classId: cls.id,
          admissionNumber: `ADM-2026-${String(i + 1).padStart(3, '0')}`,
          name: `${firstNames[i % firstNames.length]} ${['Kamau', 'Wanjiru', 'Otieno', 'Mwangi', 'Njeri'][i % 5]}`,
          guardianName: 'Guardian Name',
          guardianPhone: `+2547${String(10000000 + i).slice(0, 8)}`,
          guardianEmail: `guardian${i}@example.test`,
        },
      }),
    );
  }

  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    const expected = 51000;
    const paid = i % 4 === 0 ? 0 : i % 3 === 0 ? 25500 : expected;
    const status = paid === 0 ? 'ISSUED' : paid < expected ? 'PARTIAL' : 'PAID';
    await db.feeInvoice.create({
      data: {
        organizationId,
        studentId: student.id,
        termId: term.id,
        status,
        totalExpected: expected,
        amountPaid: paid,
        issuedAt: daysAgo(30),
        dueDate: daysAhead(10),
        lineItems: {
          create: [
            { description: 'Tuition Fee', amount: 45000 },
            { description: 'Activity Fee', amount: 3500 },
            { description: 'Exam Fee', amount: 2500 },
          ],
        },
        payments:
          paid > 0
            ? { create: [{ amount: paid, method: i % 2 === 0 ? 'MPESA' : 'CASH', reference: `REF-${i}` }] }
            : undefined,
      },
    });
  }
}

async function seedIsp(organizationId: string, actorId: string): Promise<void> {
  const items = await seedInventory(organizationId);
  await seedTransactions(organizationId, items, actorId);

  const plans: Awaited<ReturnType<typeof db.servicePlan.create>>[] = [];
  for (const plan of [
    { name: 'Home Fibre 10Mbps', price: 2500, speedMbps: 10 },
    { name: 'Home Fibre 20Mbps', price: 3500, speedMbps: 20 },
    { name: 'Business Dedicated 50Mbps', price: 12000, speedMbps: 50 },
  ]) {
    plans.push(await db.servicePlan.create({ data: { organizationId, ...plan, billingCycle: 'MONTHLY', connectionType: 'PPPOE' } }));
  }

  const subscribers: { id: string }[] = [];
  for (let i = 0; i < 30; i += 1) {
    subscribers.push(
      await db.subscriber.create({
        data: {
          organizationId,
          name: `${['John', 'Mary', 'Peter', 'Aisha'][i % 4]} ${['Kamau', 'Wanjiru', 'Otieno'][i % 3]}`,
          phone: `+2547${String(20000000 + i).slice(0, 8)}`,
          address: `Nairobi, Estate ${i + 1}`,
          connectionType: 'PPPOE',
          planId: plans[i % plans.length].id,
          status: i % 7 === 0 ? 'SUSPENDED' : 'ACTIVE',
        },
      }),
    );
  }

  for (let i = 0; i < subscribers.length; i += 1) {
    const sub = subscribers[i];
    const plan = plans[i % plans.length];
    await db.invoice.create({
      data: {
        organizationId,
        subscriberId: sub.id,
        planId: plan.id,
        status: i % 3 === 0 ? 'ISSUED' : i % 3 === 1 ? 'PAID' : 'PARTIAL',
        roomTotal: plan.price,
        consumptionTotal: 0,
        adjustmentsTotal: 0,
        amountPaid: i % 3 === 0 ? 0 : i % 3 === 1 ? plan.price : Number(plan.price) / 2,
        issuedAt: daysAgo(20),
        dueDate: daysAgo(5),
        lineItems: {
          create: [{ description: `${plan.name} subscription`, quantity: 1, unitPrice: plan.price, total: plan.price }],
        },
      },
    });
  }

  await db.workOrder.createMany({
    data: [
      { organizationId, subscriberId: subscribers[0].id, type: 'INSTALLATION', status: 'SCHEDULED', scheduledAt: daysAhead(1), technicianName: 'Tech One', notes: 'New installation' },
      { organizationId, subscriberId: subscribers[1].id, type: 'REPAIR', status: 'IN_PROGRESS', scheduledAt: daysAhead(2), technicianName: 'Tech Two' },
      { organizationId, subscriberId: subscribers[2].id, type: 'RELOCATION', status: 'COMPLETED', completedAt: daysAgo(1), technicianName: 'Tech One' },
    ],
  });

  await db.ticket.createMany({
    data: [
      { organizationId, subscriberId: subscribers[0].id, subject: 'No internet since morning', description: 'Customer reports a red LOS light.', status: 'OPEN' },
      { organizationId, subscriberId: subscribers[1].id, subject: 'Slow speeds in the evening', description: 'Speed drops below 2Mbps after 7pm.', status: 'IN_PROGRESS' },
      { organizationId, subscriberId: subscribers[2].id, subject: 'Billing query', description: 'Customer disputes a double charge.', status: 'RESOLVED' },
    ],
  });
}

async function seedVertical(
  businessType: BusinessType,
  organizationId: string,
  actorId: string,
): Promise<void> {
  switch (businessType) {
    case 'RESTAURANT':
      await seedRestaurant(organizationId, actorId);
      break;
    case 'GUEST_HOUSE':
      await seedGuestHouse(organizationId, actorId);
      break;
    case 'SCHOOL':
      await seedSchool(organizationId, actorId);
      break;
    case 'ISP':
      await seedIsp(organizationId, actorId);
      break;
    default:
      await seedRetailLike(organizationId, businessType, actorId);
  }
}

async function main(): Promise<void> {
  await db.$connect();
  await truncateAll();

  const owner = await db.user.create({
    data: { clerkId: 'e2e-owner', name: 'E2E Owner', email: 'e2e-owner@example.test' },
  });
  const staff = await db.user.create({
    data: { clerkId: 'e2e-staff', name: 'E2E Staff', email: 'e2e-staff@example.test' },
  });

  const seed: Record<string, { id: string; name: string; businessType: string }> = {};
  for (const businessType of BUSINESS_TYPES) {
    const org = await db.organization.create({
      data: {
        name: `E2E ${businessType.replace('_', ' ')}`,
        businessType,
        currency: 'KES',
        country: 'KE',
        inviteCode: `E2E-${businessType}`,
      },
    });
    await db.orgMembership.create({ data: { userId: owner.id, organizationId: org.id, role: 'OWNER' } });
    await db.orgMembership.create({ data: { userId: staff.id, organizationId: org.id, role: 'STAFF' } });
    seed[businessType] = { id: org.id, name: org.name, businessType };
    // Seed sequentially so a failure identifies the vertical.
    await seedVertical(businessType, org.id, owner.id);
  }

  const outDir = resolve(__dirname, '../../../e2e/.auth');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'seed.json'), JSON.stringify(seed, null, 2));

  // eslint-disable-next-line no-console
  console.log(`[e2e-seed] seeded ${BUSINESS_TYPES.length} organisations`);
  await db.$disconnect();
}

void main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('[e2e-seed] failed', error);
  await db.$disconnect();
  process.exit(1);
});
