/**
 * simulate-business-activity.ts
 *
 * Creates one fresh test organization per HisaFlow business type and
 * simulates a week of realistic day-to-day activity for each, so the app
 * can be browsed with populated, believable data instead of an empty
 * account.
 *
 * DESIGN
 * ------
 * Every simulated event goes through the real NestJS service layer (the
 * same classes the HTTP controllers call) - not raw database writes. This
 * matters because several business types have real logic that a naive
 * seed script would either get wrong or silently skip: tiered bulk
 * pricing (wholesaler), composite recipe deduction (restaurant), FIFO
 * batch/expiry deduction (chemist), credit-sale bookkeeping, invoice
 * totals, etc. Running through the services guarantees the seeded data is
 * internally consistent with what the app would have produced from real
 * usage.
 *
 * Events execute in true chronological order (oldest simulated day
 * first), so stock levels, invoice states, and payment statuses evolve
 * correctly step by step. Since most tables default `createdAt` to
 * `now()`, each record's timestamp is patched to its intended simulated
 * moment immediately after creation - the business logic already ran
 * correctly against real "current" state, only the audit timestamp is
 * back-dated afterward.
 *
 * Two things are NOT back-dated, on purpose:
 *   - Alert rows: these represent "current state" notifications; showing
 *     them as freshly generated when you open the app is more useful than
 *     scattering them across the week.
 *   - Table order line items closed via TableOrdersService.closeOrder():
 *     that method does not create InventoryTransaction ledger rows today
 *     (it only decrements stock directly) - that's the app's real current
 *     behavior, not a gap introduced here. Restaurant stock will move
 *     correctly; it just won't show individual sale entries in the
 *     transaction history the way retail sales do.
 *
 * USAGE
 * -----
 *   cd apps/backend
 *   npx ts-node -r tsconfig-paths/register scripts/simulate-business-activity.ts
 *
 * Env vars (all optional):
 *   SIM_OWNER_EMAIL   Email of the existing HisaFlow user to attach as
 *                     OWNER on every created org, so you can open them in
 *                     the app afterward. Defaults to
 *                     official.daniel.mutai@gmail.com. The user must
 *                     already exist (i.e. have signed into the app at
 *                     least once) - this script does not create Clerk
 *                     identities.
 *   SIM_DAYS          How many days back the simulation window starts.
 *                     Defaults to 7 (one week).
 *   SIM_ORG_PREFIX    Prefix for the created org names, so they're easy
 *                     to spot and clean up later. Defaults to "Simulated".
 *
 * SAFETY
 * ------
 * This only ever creates NEW organizations - it never touches existing
 * orgs or data. Re-running it creates a fresh set of orgs each time
 * (names include a short random suffix). To remove a simulated org and
 * everything under it, delete the Organization row; all child tables
 * cascade or are scoped to organizationId.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { TransactionTypeDto } from '../src/modules/transactions/dto/create-transaction.dto';
import { StockBatchesService } from '../src/modules/stock-batches/stock-batches.service';
import { TieredPricingService } from '../src/modules/tiered-pricing/tiered-pricing.service';
import { TableOrdersService } from '../src/modules/table-orders/table-orders.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { GuestsService } from '../src/modules/guests/guests.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { SchoolClassesService } from '../src/modules/school-classes/school-classes.service';
import { StudentsService } from '../src/modules/students/students.service';
import { AcademicTermsService } from '../src/modules/academic-terms/academic-terms.service';
import { SchoolFeesService } from '../src/modules/school-fees/school-fees.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { CreditService } from '../src/modules/finance/credit.service';

// ─────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────

const OWNER_EMAIL = process.env.SIM_OWNER_EMAIL || 'official.daniel.mutai@gmail.com';
const SIM_DAYS = parseInt(process.env.SIM_DAYS || '7', 10);
const ORG_PREFIX = process.env.SIM_ORG_PREFIX || 'Simulated';

// ─────────────────────────────────────────────────────────────────────────
// Deterministic RNG (seeded, so re-running produces the same story - makes
// it easier to reason about / debug a specific run rather than a new
// random dataset every time)
// ─────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260817);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 2): number {
  const v = rand() * (max - min) + min;
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function maybe(probability: number): boolean {
  return rand() < probability;
}
function randomSuffix(): string {
  return Math.floor(rand() * 9000 + 1000).toString();
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────────────────────────────────

/** A Date `daysAgo` days before today, at the given hour (business hours). */
function dayTimestamp(daysAgo: number, hour: number, minute = randInt(0, 59)): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, randInt(0, 59), 0);
  return d;
}

/** ISO date string (no time) for `daysAgo`/`daysAhead` from today. */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/** Patches a row's timestamp after the fact - see file header for why.
 * `field` lets callers target a model's actual timestamp column, since
 * not every table uses `createdAt` (e.g. FeePayment uses `recordedAt`). */
async function backdate(prisma: any, table: string, id: string | null | undefined, date: Date, field = 'createdAt') {
  if (!id) return;
  try {
    await prisma[table].update({ where: { id }, data: { [field]: date } });
  } catch (err) {
    console.warn(`  (could not backdate ${table} ${id}):`, (err as Error).message);
  }
}

/** The most recently created InventoryTransaction for an item - used to
 * recover an ID after TransactionsService.create(), which doesn't return
 * the row it created. Safe because events run strictly sequentially. */
async function latestTransactionId(prisma: any, orgId: string, itemId: string): Promise<string | null> {
  const row = await prisma.inventoryTransaction.findFirst({
    where: { organizationId: orgId, itemId },
    orderBy: { createdAt: 'desc' },
  });
  return row?.id ?? null;
}

const ACTOR = { actorId: 'sim-script', actorName: 'Simulated Activity', actorRole: 'OWNER' };

// ─────────────────────────────────────────────────────────────────────────
// Shared services bundle passed into each vertical simulator
// ─────────────────────────────────────────────────────────────────────────

interface Services {
  prisma: any;
  inventory: InventoryService;
  transactions: TransactionsService;
  stockBatches: StockBatchesService;
  tieredPricing: TieredPricingService;
  tableOrders: TableOrdersService;
  rooms: RoomsService;
  guests: GuestsService;
  bookings: BookingsService;
  invoices: InvoicesService;
  schoolClasses: SchoolClassesService;
  students: StudentsService;
  academicTerms: AcademicTermsService;
  schoolFees: SchoolFeesService;
  finance: FinanceService;
  credit: CreditService;
}

interface CatalogItem {
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  startingQty: number;
  reorderThreshold: number;
}

/** Creates a simple single-variant product for each catalog entry, returns name -> variantId. */
async function seedCatalog(svc: Services, orgId: string, items: CatalogItem[]): Promise<Map<string, string>> {
  const idByName = new Map<string, string>();
  for (const item of items) {
    const product = await svc.inventory.create(
      {
        name: item.name,
        category: item.category,
        variants: [
          {
            name: item.name,
            unit: item.unit,
            quantity: item.startingQty,
            reorderThreshold: item.reorderThreshold,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
          },
        ],
      } as any,
      orgId,
    );
    idByName.set(item.name, product.variants[0].id);
  }
  return idByName;
}

/** Generic daily SALE pattern across a catalog. Some sales go on credit
 * (repayment is handled separately by simulateCreditRepayments, which
 * queries CreditRecord directly rather than tracking IDs here). */
async function simulateDailySales(
  svc: Services,
  orgId: string,
  itemIds: string[],
  opts: {
    days: number;
    salesPerDay: [number, number];
    qtyRange: [number, number];
    creditProbability: number;
    clientNames: string[];
  },
) {
  for (let d = opts.days - 1; d >= 0; d--) {
    const numSales = randInt(opts.salesPerDay[0], opts.salesPerDay[1]);
    for (let i = 0; i < numSales; i++) {
      const itemId = pick(itemIds);
      const qty = randInt(opts.qtyRange[0], opts.qtyRange[1]);
      const isCredit = maybe(opts.creditProbability);
      const hour = randInt(7, 20);

      try {
        await svc.transactions.create(
          {
            itemId,
            type: TransactionTypeDto.SALE,
            quantity: qty,
            isCredit,
            clientName: isCredit ? pick(opts.clientNames) : undefined,
            dueDate: isCredit ? isoDate(randInt(3, 14)) : undefined,
          } as any,
          orgId,
          ACTOR,
        );
      } catch (err) {
        // Insufficient stock etc. - skip this one sale, keep the day going.
        continue;
      }

      const txId = await latestTransactionId(svc.prisma, orgId, itemId);
      const ts = dayTimestamp(d, hour);
      if (txId) await backdate(svc.prisma, 'inventoryTransaction', txId, ts);
    }
  }
}

/** A handful of restock (PURCHASE) events spread across the week. */
async function simulateRestocks(svc: Services, orgId: string, itemIds: string[], days: number, count: number) {
  for (let i = 0; i < count; i++) {
    const itemId = pick(itemIds);
    const day = randInt(0, days - 1);
    const qty = randInt(10, 60);
    try {
      await svc.transactions.create(
        { itemId, type: TransactionTypeDto.PURCHASE, quantity: qty, note: 'Supplier restock' } as any,
        orgId,
        ACTOR,
      );
    } catch {
      continue;
    }
    const txId = await latestTransactionId(svc.prisma, orgId, itemId);
    if (txId) await backdate(svc.prisma, 'inventoryTransaction', txId, dayTimestamp(day, randInt(8, 11)));
  }
}

/** A couple of wastage/adjustment events for realism. */
async function simulateWastage(svc: Services, orgId: string, itemIds: string[], days: number, count: number) {
  for (let i = 0; i < count; i++) {
    const itemId = pick(itemIds);
    const day = randInt(0, days - 1);
    const type = maybe(0.6) ? TransactionTypeDto.WASTAGE : TransactionTypeDto.ADJUSTMENT;
    const qty = randInt(1, 4);
    try {
      await svc.transactions.create(
        {
          itemId,
          type,
          quantity: qty,
          note: type === TransactionTypeDto.WASTAGE ? 'Spoilage / breakage' : 'Stock count correction',
        } as any,
        orgId,
        ACTOR,
      );
    } catch {
      continue;
    }
    const txId = await latestTransactionId(svc.prisma, orgId, itemId);
    if (txId) await backdate(svc.prisma, 'inventoryTransaction', txId, dayTimestamp(day, randInt(9, 18)));
  }
}

/** Repay a subset of the credit sales generated during the week. */
async function simulateCreditRepayments(svc: Services, orgId: string, days: number) {
  const credits = await svc.prisma.creditRecord.findMany({
    where: { organizationId: orgId, status: { not: 'PAID' } },
  });
  for (const credit of credits) {
    if (!maybe(0.55)) continue; // leave some unpaid, realistic for a single week
    const total = Number(credit.amountTotal);
    if (total <= 0) continue;
    const isFull = maybe(0.5);
    const amount = isFull ? total : Math.round(total * randFloat(0.3, 0.7) * 100) / 100;
    const day = randInt(0, days - 1);
    try {
      await svc.credit.recordPayment(credit.id, orgId, { amount, notes: 'Partial settlement' } as any);
    } catch {
      continue;
    }
    // Backdate the credit record + the auto-generated INCOME ledger entry it created.
    await backdate(svc.prisma, 'creditRecord', credit.id, dayTimestamp(day, randInt(9, 18)));
    const latestBizTx = await svc.prisma.businessTransaction.findFirst({
      where: { organizationId: orgId, category: 'CREDIT_PAYMENT' },
      orderBy: { date: 'desc' },
    });
    if (latestBizTx) {
      await svc.prisma.businessTransaction.update({
        where: { id: latestBizTx.id },
        data: { date: dayTimestamp(day, randInt(9, 18)) },
      });
    }
  }
}

/** A few recurring-feeling business expenses spread across the week. */
async function simulateExpenses(
  svc: Services,
  orgId: string,
  days: number,
  expenses: { category: string; description: string; amountRange: [number, number] }[],
) {
  for (const exp of expenses) {
    const day = randInt(0, days - 1);
    await svc.finance.createBusinessTransaction(orgId, {
      type: 'EXPENSE',
      category: exp.category,
      amount: randFloat(exp.amountRange[0], exp.amountRange[1], 0),
      description: exp.description,
      date: isoDate(-day),
    } as any);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Vertical: Retail (DUKA / MINI_MART) and ISP (rides on the same generic
// inventory + finance layer - no bespoke ISP data model exists yet)
// ─────────────────────────────────────────────────────────────────────────

const DUKA_CATALOG: CatalogItem[] = [
  { name: 'Unga (Maize Flour) 2kg', category: 'Staples', unit: 'packet', costPrice: 150, sellingPrice: 180, startingQty: 40, reorderThreshold: 10 },
  { name: 'Sugar 1kg', category: 'Staples', unit: 'packet', costPrice: 140, sellingPrice: 165, startingQty: 35, reorderThreshold: 8 },
  { name: 'Cooking Oil 1L', category: 'Staples', unit: 'bottle', costPrice: 220, sellingPrice: 260, startingQty: 25, reorderThreshold: 6 },
  { name: 'Rice 2kg', category: 'Staples', unit: 'packet', costPrice: 260, sellingPrice: 310, startingQty: 20, reorderThreshold: 5 },
  { name: 'Bread', category: 'Bakery', unit: 'loaf', costPrice: 55, sellingPrice: 65, startingQty: 15, reorderThreshold: 5 },
  { name: 'Milk 500ml', category: 'Dairy', unit: 'packet', costPrice: 50, sellingPrice: 60, startingQty: 30, reorderThreshold: 10 },
  { name: 'Soap Bar', category: 'Household', unit: 'piece', costPrice: 45, sellingPrice: 60, startingQty: 40, reorderThreshold: 10 },
  { name: 'Washing Powder 500g', category: 'Household', unit: 'packet', costPrice: 90, sellingPrice: 115, startingQty: 20, reorderThreshold: 5 },
  { name: 'Soda 500ml', category: 'Beverages', unit: 'bottle', costPrice: 45, sellingPrice: 60, startingQty: 48, reorderThreshold: 12 },
  { name: 'Matches', category: 'Household', unit: 'box', costPrice: 8, sellingPrice: 15, startingQty: 60, reorderThreshold: 15 },
  { name: 'Salt 500g', category: 'Staples', unit: 'packet', costPrice: 20, sellingPrice: 30, startingQty: 30, reorderThreshold: 8 },
  { name: 'Eggs (Tray)', category: 'Dairy', unit: 'tray', costPrice: 380, sellingPrice: 420, startingQty: 10, reorderThreshold: 3 },
  { name: 'Airtime Scratch Card 100', category: 'Airtime', unit: 'card', costPrice: 95, sellingPrice: 100, startingQty: 25, reorderThreshold: 5 },
  { name: 'Toilet Paper (2-pack)', category: 'Household', unit: 'pack', costPrice: 70, sellingPrice: 90, startingQty: 20, reorderThreshold: 5 },
];

const ISP_CATALOG: CatalogItem[] = [
  { name: 'Wireless Router', category: 'Equipment', unit: 'unit', costPrice: 3500, sellingPrice: 4800, startingQty: 12, reorderThreshold: 3 },
  { name: 'Ethernet Cable 20m', category: 'Equipment', unit: 'roll', costPrice: 800, sellingPrice: 1200, startingQty: 15, reorderThreshold: 4 },
  { name: 'Data Bundle 10GB (Monthly)', category: 'Bundles', unit: 'code', costPrice: 800, sellingPrice: 1200, startingQty: 50, reorderThreshold: 10 },
  { name: 'Data Bundle 30GB (Monthly)', category: 'Bundles', unit: 'code', costPrice: 2000, sellingPrice: 2800, startingQty: 40, reorderThreshold: 10 },
  { name: 'Installation Kit', category: 'Equipment', unit: 'kit', costPrice: 1500, sellingPrice: 2200, startingQty: 8, reorderThreshold: 2 },
  { name: 'PoE Injector', category: 'Equipment', unit: 'unit', costPrice: 900, sellingPrice: 1400, startingQty: 10, reorderThreshold: 3 },
];

async function simulateRetail(svc: Services, orgId: string, catalog: CatalogItem[], clientNames: string[]) {
  const idByName = await seedCatalog(svc, orgId, catalog);
  const ids = [...idByName.values()];

  await simulateDailySales(svc, orgId, ids, {
    days: SIM_DAYS,
    salesPerDay: [8, 16],
    qtyRange: [1, 4],
    creditProbability: 0.15,
    clientNames,
  });
  await simulateRestocks(svc, orgId, ids, SIM_DAYS, 3);
  await simulateWastage(svc, orgId, ids, SIM_DAYS, 2);
  await simulateCreditRepayments(svc, orgId, SIM_DAYS);
  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'RENT', description: 'Shop rent', amountRange: [3000, 3000] },
    { category: 'TRANSPORT', description: 'Stock transport / matatu fare', amountRange: [200, 600] },
    { category: 'UTILITIES', description: 'Electricity token', amountRange: [300, 800] },
  ]);
}

async function simulateISP(svc: Services, orgId: string) {
  const idByName = await seedCatalog(svc, orgId, ISP_CATALOG);
  const ids = [...idByName.values()];

  await simulateDailySales(svc, orgId, ids, {
    days: SIM_DAYS,
    salesPerDay: [3, 7],
    qtyRange: [1, 2],
    creditProbability: 0.25, // customers "on account" are common for ISPs
    clientNames: ['Mwangi Residence', 'Kamau Cyber Cafe', 'Wanjiru Apartments', 'Otieno Office', 'St. Mary\'s Hostel'],
  });
  await simulateRestocks(svc, orgId, ids, SIM_DAYS, 2);
  await simulateCreditRepayments(svc, orgId, SIM_DAYS);
  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'BANDWIDTH', description: 'Upstream bandwidth cost', amountRange: [8000, 8000] },
    { category: 'SALARIES', description: 'Field technician wages', amountRange: [2500, 2500] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Vertical: Wholesaler (retail catalog in bulk units + tiered pricing)
// ─────────────────────────────────────────────────────────────────────────

const WHOLESALE_CATALOG: CatalogItem[] = [
  { name: 'Unga (Maize Flour) - Carton (12x2kg)', category: 'Staples', unit: 'carton', costPrice: 1600, sellingPrice: 1950, startingQty: 60, reorderThreshold: 15 },
  { name: 'Sugar - Sack (50kg)', category: 'Staples', unit: 'sack', costPrice: 6200, sellingPrice: 6900, startingQty: 25, reorderThreshold: 6 },
  { name: 'Cooking Oil - Carton (12x1L)', category: 'Staples', unit: 'carton', costPrice: 2400, sellingPrice: 2850, startingQty: 30, reorderThreshold: 8 },
  { name: 'Rice - Sack (25kg)', category: 'Staples', unit: 'sack', costPrice: 2900, sellingPrice: 3300, startingQty: 20, reorderThreshold: 5 },
  { name: 'Soap - Carton (48 bars)', category: 'Household', unit: 'carton', costPrice: 1900, sellingPrice: 2300, startingQty: 22, reorderThreshold: 5 },
  { name: 'Soda - Crate (24x500ml)', category: 'Beverages', unit: 'crate', costPrice: 950, sellingPrice: 1150, startingQty: 40, reorderThreshold: 10 },
];

async function simulateWholesaler(svc: Services, orgId: string) {
  const idByName = await seedCatalog(svc, orgId, WHOLESALE_CATALOG);
  const ids = [...idByName.values()];

  // Bulk discount tiers on a few high-volume items - price the discount
  // relative to the item's own sellingPrice, so it's a believable ~10% cut.
  for (const itemId of ids.slice(0, 4)) {
    const item = await svc.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    const discounted = Math.round(Number(item.sellingPrice) * 0.9);
    await svc.tieredPricing.upsertRules(orgId, itemId, [
      { inventoryItemId: itemId, minQuantity: 5, pricePerUnit: discounted, label: 'Bulk 5+' } as any,
    ]);
  }

  await simulateDailySales(svc, orgId, ids, {
    days: SIM_DAYS,
    salesPerDay: [4, 9],
    qtyRange: [1, 8], // occasionally crosses the bulk threshold
    creditProbability: 0.35, // dukas buying from the wholesaler commonly run accounts
    clientNames: ['Baraka Duka', 'Neema Mini Mart', 'Highway Shop', 'Mama Mboga Corner', 'Riverside Store'],
  });
  await simulateRestocks(svc, orgId, ids, SIM_DAYS, 2);
  await simulateCreditRepayments(svc, orgId, SIM_DAYS);
  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'RENT', description: 'Warehouse rent', amountRange: [15000, 15000] },
    { category: 'TRANSPORT', description: 'Delivery truck fuel', amountRange: [3000, 6000] },
    { category: 'SALARIES', description: 'Loading staff wages', amountRange: [4000, 4000] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Vertical: Chemist (batch/expiry-tracked pharma stock)
// ─────────────────────────────────────────────────────────────────────────

const CHEMIST_CATALOG: CatalogItem[] = [
  { name: 'Paracetamol 500mg (Pack of 10)', category: 'Analgesics', unit: 'pack', costPrice: 25, sellingPrice: 40, startingQty: 100, reorderThreshold: 20 },
  { name: 'Amoxicillin 250mg (Pack of 10)', category: 'Antibiotics', unit: 'pack', costPrice: 60, sellingPrice: 90, startingQty: 60, reorderThreshold: 15 },
  { name: 'ORS Sachet', category: 'Rehydration', unit: 'sachet', costPrice: 15, sellingPrice: 25, startingQty: 80, reorderThreshold: 20 },
  { name: 'Cough Syrup 100ml', category: 'Cold & Flu', unit: 'bottle', costPrice: 120, sellingPrice: 170, startingQty: 30, reorderThreshold: 8 },
  { name: 'Surgical Gloves (Box of 100)', category: 'Consumables', unit: 'box', costPrice: 350, sellingPrice: 480, startingQty: 12, reorderThreshold: 3 },
  { name: 'Multivitamin Tablets (30s)', category: 'Supplements', unit: 'bottle', costPrice: 180, sellingPrice: 260, startingQty: 25, reorderThreshold: 6 },
  { name: 'Antiseptic Solution 250ml', category: 'First Aid', unit: 'bottle', costPrice: 95, sellingPrice: 140, startingQty: 20, reorderThreshold: 5 },
  { name: 'Adhesive Bandages (Box)', category: 'First Aid', unit: 'box', costPrice: 60, sellingPrice: 90, startingQty: 25, reorderThreshold: 6 },
];

async function simulateChemist(svc: Services, orgId: string) {
  const idByName = await seedCatalog(svc, orgId, CHEMIST_CATALOG);
  const ids = [...idByName.values()];

  // Give every item at least one batch. A couple get a near-expiry batch
  // on purpose, so the EXPIRY_RISK alert has something real to fire on.
  let i = 0;
  for (const itemId of ids) {
    const nearExpiry = i < 2;
    await svc.stockBatches.create(
      {
        inventoryItemId: itemId,
        batchNumber: `B${randInt(1000, 9999)}`,
        expiryDate: nearExpiry ? isoDate(randInt(10, 25)) : isoDate(randInt(180, 540)),
        quantity: randInt(20, 50),
        costPrice: undefined,
      } as any,
      orgId,
    );
    i++;
  }

  await simulateDailySales(svc, orgId, ids, {
    days: SIM_DAYS,
    salesPerDay: [10, 20],
    qtyRange: [1, 3],
    creditProbability: 0.1,
    clientNames: ['Walk-in Customer', 'Community Clinic Account', 'Boarding School Sick Bay'],
  });
  await simulateRestocks(svc, orgId, ids, SIM_DAYS, 2);
  await simulateCreditRepayments(svc, orgId, SIM_DAYS);
  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'RENT', description: 'Pharmacy rent', amountRange: [8000, 8000] },
    { category: 'LICENSING', description: 'Pharmacy \u0026 Poisons Board compliance fee', amountRange: [1500, 1500] },
    { category: 'UTILITIES', description: 'Electricity (fridge/cold chain)', amountRange: [1200, 1800] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Vertical: Restaurant (raw ingredients + composite menu items + table orders)
// ─────────────────────────────────────────────────────────────────────────

const INGREDIENTS: CatalogItem[] = [
  { name: 'Rice (raw) kg', category: 'Ingredients', unit: 'kg', costPrice: 130, sellingPrice: 0, startingQty: 60, reorderThreshold: 15 },
  { name: 'Chicken (raw) kg', category: 'Ingredients', unit: 'kg', costPrice: 420, sellingPrice: 0, startingQty: 30, reorderThreshold: 8 },
  { name: 'Cooking Oil (kitchen) L', category: 'Ingredients', unit: 'L', costPrice: 220, sellingPrice: 0, startingQty: 20, reorderThreshold: 5 },
  { name: 'Wheat Flour kg', category: 'Ingredients', unit: 'kg', costPrice: 100, sellingPrice: 0, startingQty: 40, reorderThreshold: 10 },
  { name: 'Beef (raw) kg', category: 'Ingredients', unit: 'kg', costPrice: 480, sellingPrice: 0, startingQty: 25, reorderThreshold: 6 },
  { name: 'Tomatoes kg', category: 'Ingredients', unit: 'kg', costPrice: 80, sellingPrice: 0, startingQty: 20, reorderThreshold: 5 },
  { name: 'Onions kg', category: 'Ingredients', unit: 'kg', costPrice: 70, sellingPrice: 0, startingQty: 20, reorderThreshold: 5 },
  { name: 'Soda 500ml (fridge)', category: 'Beverages', unit: 'bottle', costPrice: 45, sellingPrice: 0, startingQty: 60, reorderThreshold: 15 },
];

interface MenuItem {
  name: string;
  price: number;
  recipe: { ingredient: string; qtyPerServing: number }[];
}

const MENU: MenuItem[] = [
  {
    name: 'Chicken Pilau',
    price: 350,
    recipe: [
      { ingredient: 'Rice (raw) kg', qtyPerServing: 0.25 },
      { ingredient: 'Chicken (raw) kg', qtyPerServing: 0.2 },
      { ingredient: 'Cooking Oil (kitchen) L', qtyPerServing: 0.03 },
      { ingredient: 'Onions kg', qtyPerServing: 0.05 },
    ],
  },
  {
    name: 'Beef Stew with Chapati',
    price: 320,
    recipe: [
      { ingredient: 'Beef (raw) kg', qtyPerServing: 0.2 },
      { ingredient: 'Wheat Flour kg', qtyPerServing: 0.15 },
      { ingredient: 'Tomatoes kg', qtyPerServing: 0.08 },
      { ingredient: 'Cooking Oil (kitchen) L', qtyPerServing: 0.04 },
    ],
  },
  {
    name: 'Plain Chapati (2 pcs)',
    price: 60,
    recipe: [
      { ingredient: 'Wheat Flour kg', qtyPerServing: 0.12 },
      { ingredient: 'Cooking Oil (kitchen) L', qtyPerServing: 0.02 },
    ],
  },
  {
    name: 'Soda',
    price: 70,
    recipe: [{ ingredient: 'Soda 500ml (fridge)', qtyPerServing: 1 }],
  },
];

async function simulateRestaurant(svc: Services, orgId: string) {
  const ingredientIds = await seedCatalog(svc, orgId, INGREDIENTS);

  const menuItemIds = new Map<string, string>();
  for (const menuItem of MENU) {
    const product = await svc.inventory.create(
      {
        name: menuItem.name,
        category: 'Menu',
        variants: [
          {
            name: menuItem.name,
            unit: 'serving',
            quantity: 0, // composite items don't hold their own stock
            reorderThreshold: 0,
            sellingPrice: menuItem.price,
            isComposite: true,
            recipeLines: menuItem.recipe.map((r) => ({
              ingredientId: ingredientIds.get(r.ingredient),
              quantityUsed: r.qtyPerServing,
            })),
          },
        ],
      } as any,
      orgId,
    );
    menuItemIds.set(menuItem.name, product.variants[0].id);
  }

  const tableLabels = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Takeaway'];

  for (let d = SIM_DAYS - 1; d >= 0; d--) {
    // Lunch + dinner service - a handful of orders per sitting.
    for (const sitting of [{ hourRange: [12, 14], count: randInt(4, 8) }, { hourRange: [18, 21], count: randInt(5, 10) }]) {
      for (let i = 0; i < sitting.count; i++) {
        const order = await svc.tableOrders.create({ tableLabel: pick(tableLabels) } as any, orgId);
        const numItems = randInt(1, 3);
        let orderTotal = 0;
        for (let j = 0; j < numItems; j++) {
          const menuItem = pick(MENU);
          const itemId = menuItemIds.get(menuItem.name)!;
          const qty = randInt(1, 2);
          await svc.tableOrders.addItem(order.id, { itemId, quantity: qty, unitPrice: menuItem.price } as any, orgId);
          orderTotal += menuItem.price * qty;
        }
        try {
          await svc.tableOrders.closeOrder(order.id, orgId);
        } catch {
          continue; // e.g. ran out of an ingredient - skip closing, leave it open
        }
        const hour = randInt(sitting.hourRange[0], sitting.hourRange[1]);
        const ts = dayTimestamp(d, hour);
        try {
          await svc.prisma.tableOrder.update({
            where: { id: order.id },
            data: { createdAt: ts, openedAt: ts, closedAt: ts },
          });
        } catch (err) {
          console.warn(`  (could not backdate tableOrder ${order.id}):`, (err as Error).message);
        }

        // closeOrder() doesn't itself log revenue anywhere - add a
        // supplementary income entry so the finance dashboard reflects
        // the day's takings too.
        await svc.finance.createBusinessTransaction(orgId, {
          type: 'INCOME',
          category: 'FOOD_SALES',
          amount: orderTotal,
          description: `${order.tableLabel} - order settled`,
          date: isoDate(-d),
        } as any);
      }
    }

    // One ingredient restock most days.
    if (maybe(0.7)) {
      const itemId = pick([...ingredientIds.values()]);
      try {
        await svc.transactions.create(
          { itemId, type: TransactionTypeDto.PURCHASE, quantity: randInt(10, 25), note: 'Market/supplier delivery' } as any,
          orgId,
          ACTOR,
        );
        const txId = await latestTransactionId(svc.prisma, orgId, itemId);
        if (txId) await backdate(svc.prisma, 'inventoryTransaction', txId, dayTimestamp(d, randInt(6, 9)));
      } catch {
        // ignore
      }
    }
  }

  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'RENT', description: 'Restaurant premises rent', amountRange: [12000, 12000] },
    { category: 'GAS', description: 'Cooking gas refill', amountRange: [2500, 3500] },
    { category: 'SALARIES', description: 'Kitchen \u0026 waiting staff wages', amountRange: [8000, 8000] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Vertical: School (classes, students, term, fee invoices + payments)
// ─────────────────────────────────────────────────────────────────────────

const FIRST_NAMES = ['Amina', 'Brian', 'Cynthia', 'David', 'Esther', 'Felix', 'Grace', 'Hassan', 'Irene', 'James', 'Kevin', 'Lilian', 'Moses', 'Nancy', 'Omar', 'Purity', 'Quinter', 'Robert', 'Sarah', 'Tom', 'Umi', 'Victor', 'Winnie', 'Yusuf', 'Zainab'];
const LAST_NAMES = ['Mwangi', 'Otieno', 'Wanjiru', 'Kamau', 'Achieng', 'Kiptoo', 'Njeri', 'Mutua', 'Wafula', 'Chebet', 'Odhiambo', 'Kariuki'];

async function simulateSchool(svc: Services, orgId: string) {
  const classNames = ['Grade 4', 'Grade 5', 'Grade 6'];
  const classIds: string[] = [];
  for (const name of classNames) {
    const cls = await svc.schoolClasses.create({ name } as any, orgId);
    classIds.push(cls.id);
  }

  const studentIds: { id: string; classId: string }[] = [];
  for (let i = 0; i < 22; i++) {
    const classId = pick(classIds);
    const student = await svc.students.create(
      {
        classId,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        admissionNumber: `ADM${1000 + i}`,
        guardianName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        guardianPhone: `07${randInt(10000000, 99999999)}`,
      } as any,
      orgId,
    );
    studentIds.push({ id: student.id, classId });
  }

  const term = await svc.academicTerms.create(
    {
      name: 'Term 2 2026',
      startDate: isoDate(-30),
      endDate: isoDate(60),
      dueDate: isoDate(14),
      isActive: true, // create() already deactivates other terms and activates this one
      feeStructures: [
        { name: 'Tuition', amount: 15000 },
        { name: 'Transport', amount: 3500, isOptional: true },
        { name: 'Lunch Program', amount: 2500, isOptional: true },
      ],
    } as any,
    orgId,
  );

  await svc.schoolFees.generateForTerm(term.id, orgId);

  const invoices = await svc.prisma.feeInvoice.findMany({ where: { organizationId: orgId, termId: term.id } });
  for (const invoice of invoices) {
    await svc.schoolFees.issueInvoice(invoice.id, orgId);
  }

  // Fee collection pattern across the week: some pay in full early, some
  // pay partially, a portion remain defaulters (realistic for one week
  // into a term's payment window).
  for (const invoice of invoices) {
    const totalDue = Number(invoice.totalExpected) + Number(invoice.adjustmentsTotal);
    if (totalDue <= 0) continue;
    const behavior = rand();
    const day = randInt(0, SIM_DAYS - 1);
    let amount = 0;
    if (behavior < 0.35) amount = totalDue; // paid in full
    else if (behavior < 0.75) amount = Math.round(totalDue * randFloat(0.3, 0.7));
    else continue; // defaulter this week

    try {
      await svc.schoolFees.recordPayment(
        invoice.id,
        { amount, method: pick(['MPESA', 'CASH', 'BANK']), reference: `PMT${randInt(100000, 999999)}` } as any,
        orgId,
      );
    } catch {
      continue;
    }
    const payment = await svc.prisma.feePayment.findFirst({
      where: { invoiceId: invoice.id },
      orderBy: { recordedAt: 'desc' },
    });
    await backdate(svc.prisma, 'feePayment', payment?.id, dayTimestamp(day, randInt(8, 16)), 'recordedAt');
  }

  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'SALARIES', description: 'Teaching staff salaries', amountRange: [45000, 45000] },
    { category: 'UTILITIES', description: 'Electricity \u0026 water', amountRange: [3000, 5000] },
    { category: 'SUPPLIES', description: 'Stationery \u0026 teaching materials', amountRange: [4000, 8000] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Vertical: Guest House (rooms, guests, bookings, consumption, invoices)
// ─────────────────────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { type: 'Standard', baseRate: 2500, count: 4 },
  { type: 'Deluxe', baseRate: 4000, count: 3 },
  { type: 'Suite', baseRate: 6500, count: 2 },
];

const GUEST_NAMES = ['Peter Kimani', 'Alice Njoroge', 'John Mwangi', 'Faith Achieng', 'Samuel Kiprono', 'Mercy Wambui', 'Daniel Otieno', 'Ruth Chebet', 'George Mutiso', 'Joyce Wanjiku', 'Michael Ochieng', 'Beatrice Nyambura'];

const EXTRAS_CATALOG: CatalogItem[] = [
  { name: 'Bottled Water 500ml', category: 'Extras', unit: 'bottle', costPrice: 30, sellingPrice: 50, startingQty: 60, reorderThreshold: 15 },
  { name: 'Soda (room service)', category: 'Extras', unit: 'bottle', costPrice: 45, sellingPrice: 80, startingQty: 40, reorderThreshold: 10 },
  { name: 'Snack Pack', category: 'Extras', unit: 'pack', costPrice: 100, sellingPrice: 180, startingQty: 25, reorderThreshold: 6 },
];

async function simulateGuestHouse(svc: Services, orgId: string) {
  const roomIds: string[] = [];
  for (const rt of ROOM_TYPES) {
    for (let i = 1; i <= rt.count; i++) {
      const room = await svc.rooms.create(orgId, { name: `${rt.type} ${i}`, type: rt.type, baseRate: rt.baseRate } as any);
      roomIds.push(room.id);
    }
  }

  const guestIds: string[] = [];
  for (const name of GUEST_NAMES) {
    const guest = await svc.guests.create(orgId, { name, phone: `07${randInt(10000000, 99999999)}` } as any);
    guestIds.push(guest.id);
  }

  const extrasIdByName = await seedCatalog(svc, orgId, EXTRAS_CATALOG);
  const extrasIds = [...extrasIdByName.values()];

  const usedRoomDayRanges: { roomId: string; start: number; end: number }[] = [];

  const numBookings = 10;
  for (let b = 0; b < numBookings; b++) {
    const roomId = pick(roomIds);
    // checkIn `start` days ago, staying `nights` nights. A couple of
    // bookings extend past "today" so some guests are still checked in.
    const start = randInt(0, SIM_DAYS - 1);
    const nights = randInt(1, 4);
    const end = start - nights; // more negative = further in the future relative to "start days ago"

    // Skip if this room is already booked over an overlapping window (the
    // service enforces this anyway - this just avoids wasting an attempt).
    const overlaps = usedRoomDayRanges.some(
      (r) => r.roomId === roomId && !(end > r.start || start < r.end),
    );
    if (overlaps) continue;
    usedRoomDayRanges.push({ roomId, start, end });

    const guestId = pick(guestIds);
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() - start);
    const checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() - end);

    let booking;
    try {
      booking = await svc.bookings.create(orgId, {
        roomId,
        guestId,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
      } as any);
    } catch {
      continue; // overlap the service itself rejected
    }

    const hasCheckedIn = start >= 0; // check-in date has already occurred in our window
    if (hasCheckedIn) {
      await svc.bookings.checkIn(orgId, booking.id);
      // checkIn() just stamped actualCheckIn = real "now". The invoice's
      // room-total calc prefers actualCheckIn over checkInDate whenever
      // it's set, so left uncorrected every booking would price out to
      // exactly 1 night (today vs a past date). Fix it to the intended
      // simulated check-in moment before any invoice draft gets generated.
      await svc.prisma.booking.update({
        where: { id: booking.id },
        data: { actualCheckIn: checkInDate, createdAt: checkInDate },
      });

      // A couple of room-service extras during the stay.
      const numExtras = randInt(0, 3);
      for (let e = 0; e < numExtras; e++) {
        const itemId = pick(extrasIds);
        const item = await svc.prisma.inventoryItem.findUnique({ where: { id: itemId } });
        const qty = randInt(1, 2);
        try {
          await svc.bookings.addConsumption(orgId, booking.id, { itemId, quantity: qty } as any, ACTOR.actorId);
          await svc.invoices.addLineItem(orgId, booking.id, {
            description: `${item.name} x${qty}`,
            quantity: qty,
            unitPrice: Number(item.sellingPrice),
          } as any);
          const consumptionTxId = await latestTransactionId(svc.prisma, orgId, itemId);
          await backdate(svc.prisma, 'inventoryTransaction', consumptionTxId, dayTimestamp(Math.max(start - randInt(0, Math.max(nights - 1, 0)), 0), randInt(9, 21)));
        } catch {
          continue;
        }
      }

      // Issuing generates the invoice draft on first access (idempotent
      // after that) - roomTotal is computed and cached at this point, so
      // actualCheckIn above must already be correct before this call.
      await svc.invoices.issue(orgId, booking.id);

      const stayHasEnded = end >= 0; // checkout date has already occurred
      const invoice = await svc.prisma.invoice.findUnique({ where: { bookingId: booking.id } });
      const totalDue = Number(invoice.roomTotal) + Number(invoice.consumptionTotal) + Number(invoice.adjustmentsTotal);

      if (stayHasEnded) {
        // Settled and checked out.
        await svc.invoices.addPayment(orgId, booking.id, { amount: totalDue, method: pick(['MPESA', 'CASH', 'CARD']) } as any);
        await svc.bookings.checkOut(orgId, booking.id);
        // Same correction for the departure timestamp (display only at
        // this point - roomTotal is already computed and stored).
        await svc.prisma.booking.update({
          where: { id: booking.id },
          data: { actualCheckOut: checkOutDate },
        });
      } else if (maybe(0.5)) {
        // Still staying, but paid a deposit.
        await svc.invoices.addPayment(orgId, booking.id, { amount: Math.round(totalDue * 0.5), method: 'MPESA' } as any);
      }
    }
    // else: a future reservation, left as RESERVED - also realistic for a demo.
  }

  await simulateExpenses(svc, orgId, SIM_DAYS, [
    { category: 'SALARIES', description: 'Housekeeping \u0026 front desk wages', amountRange: [9000, 9000] },
    { category: 'UTILITIES', description: 'Electricity \u0026 water', amountRange: [3500, 6000] },
    { category: 'SUPPLIES', description: 'Linen, toiletries \u0026 cleaning supplies', amountRange: [2000, 4000] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────
// Orchestration
// ─────────────────────────────────────────────────────────────────────────

interface Vertical {
  businessType: string;
  label: string;
  simulate: (svc: Services, orgId: string) => Promise<void>;
}

const VERTICALS: Vertical[] = [
  {
    businessType: 'DUKA',
    label: 'Duka',
    simulate: (svc, orgId) => simulateRetail(svc, orgId, DUKA_CATALOG, ['Mama Njoki', 'Kip', 'Wanjiru (regular)']),
  },
  {
    businessType: 'MINI_MART',
    label: 'Mini Mart',
    simulate: (svc, orgId) => simulateRetail(svc, orgId, DUKA_CATALOG, ['Corner Kiosk', 'Mama Fatuma', 'Peter (student)']),
  },
  { businessType: 'WHOLESALER', label: 'Wholesaler', simulate: simulateWholesaler },
  { businessType: 'CHEMIST', label: 'Chemist', simulate: simulateChemist },
  { businessType: 'RESTAURANT', label: 'Restaurant', simulate: simulateRestaurant },
  { businessType: 'SCHOOL', label: 'School', simulate: simulateSchool },
  { businessType: 'GUEST_HOUSE', label: 'Guest House', simulate: simulateGuestHouse },
  { businessType: 'ISP', label: 'ISP', simulate: simulateISP },
];

async function main() {
  console.log(`Booting NestJS application context...`);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const prisma = app.get(PrismaService).db;
  const svc: Services = {
    prisma,
    inventory: app.get(InventoryService),
    transactions: app.get(TransactionsService),
    stockBatches: app.get(StockBatchesService),
    tieredPricing: app.get(TieredPricingService),
    tableOrders: app.get(TableOrdersService),
    rooms: app.get(RoomsService),
    guests: app.get(GuestsService),
    bookings: app.get(BookingsService),
    invoices: app.get(InvoicesService),
    schoolClasses: app.get(SchoolClassesService),
    students: app.get(StudentsService),
    academicTerms: app.get(AcademicTermsService),
    schoolFees: app.get(SchoolFeesService),
    finance: app.get(FinanceService),
    credit: app.get(CreditService),
  };
  const organizationsService = app.get(OrganizationsService);

  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.error(
      `\nNo HisaFlow user found with email "${OWNER_EMAIL}".\n` +
        `Sign into the app at least once with this account first (so Clerk sync creates the user record), then re-run this script.\n` +
        `Or set SIM_OWNER_EMAIL to an email that already has a HisaFlow account.\n`,
    );
    await app.close();
    process.exit(1);
  }

  console.log(`Owner: ${owner.email} (${owner.id})`);
  console.log(`Simulating ${SIM_DAYS} day(s) of activity across ${VERTICALS.length} business types...\n`);

  const results: { businessType: string; orgName: string; orgId: string }[] = [];
  const suffix = randomSuffix();

  for (const vertical of VERTICALS) {
    const orgName = `${ORG_PREFIX} ${vertical.label} #${suffix}`;
    console.log(`=== ${vertical.businessType}: creating "${orgName}" ===`);
    const org = await organizationsService.create({ name: orgName, businessType: vertical.businessType } as any, owner.id);

    try {
      await vertical.simulate(svc, org.id);
      console.log(`  done.`);
    } catch (err) {
      console.error(`  FAILED partway through:`, err);
    }

    results.push({ businessType: vertical.businessType, orgName, orgId: org.id });
  }

  console.log(`\n=== Summary ===`);
  console.table(results);

  // The real services fire alert/credit side effects without awaiting them
  // internally (see e.g. TransactionsService.create). Give any in-flight
  // writes a moment to land before we tear down the Prisma connection.
  console.log(`Waiting for background side effects to flush...`);
  await sleep(5000);

  await app.close();
  console.log(`Done. Open the app as ${owner.email} to browse the ${VERTICALS.length} new orgs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
