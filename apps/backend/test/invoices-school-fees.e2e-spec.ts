import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { createE2eApp, request, truncateAll } from './utils/e2e-app';

/**
 * Layer 2 — money modules not covered by `money-flow.e2e-spec.ts`:
 * booking invoices and school fees. Round-trips request → guard → controller
 * → service → real Postgres, and proves org isolation at the DB level.
 */
describe('Invoices + school fees (e2e, real Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  async function seedOrg(label: string, role: 'OWNER' | 'MANAGER' | 'STAFF' = 'OWNER') {
    const org = await prisma.db.organization.create({
      data: { name: label, businessType: 'GUEST_HOUSE' },
    });
    const user = await prisma.db.user.create({
      data: { clerkId: `${label}-${role}`, name: `${label} ${role}` },
    });
    await prisma.db.orgMembership.create({
      data: { organizationId: org.id, userId: user.id, role },
    });
    return { org, user };
  }

  async function seedBooking(orgId: string) {
    const room = await prisma.db.room.create({
      data: {
        organizationId: orgId,
        name: 'Room 1',
        type: 'Double',
        baseRate: new Prisma.Decimal('2500.00'),
      },
    });
    const guest = await prisma.db.guest.create({
      data: { organizationId: orgId, name: 'Jane Guest' },
    });
    const booking = await prisma.db.booking.create({
      data: {
        organizationId: orgId,
        roomId: room.id,
        guestId: guest.id,
        checkInDate: new Date('2026-11-01T14:00:00.000Z'),
        checkOutDate: new Date('2026-11-03T10:00:00.000Z'),
        ratePerNight: new Prisma.Decimal('2500.00'),
      },
    });
    return { room, guest, booking };
  }

  describe('booking invoices', () => {
    it('creates a draft invoice totalling 2 nights at the room rate', async () => {
      const { org, user } = await seedOrg('Alpha');
      const { booking } = await seedBooking(org.id);

      const response = await request(app, `/invoices/booking/${booking.id}`, {
        orgId: org.id,
        userId: user.id,
      });

      expect(response.status).toBe(200);
      expect(Number(response.body.roomTotal)).toBe(5000);
      expect(response.body.status).toBe('DRAFT');

      // Persisted, not just computed in memory.
      const persisted = await prisma.db.invoice.findFirstOrThrow({
        where: { organizationId: org.id, bookingId: booking.id },
      });
      expect(persisted.roomTotal.toString()).toBe('5000');
    });

    it('adds a line item and folds it into the invoice total', async () => {
      const { org, user } = await seedOrg('Alpha');
      const { booking } = await seedBooking(org.id);

      const response = await request(app, `/invoices/booking/${booking.id}/line-items`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
        body: { description: 'Laundry', quantity: 2, unitPrice: 750.5 },
      });

      expect(response.status).toBe(201);
      expect(Number(response.body.adjustmentsTotal)).toBe(1501);
      expect(response.body.lineItems).toHaveLength(1);
      expect(Number(response.body.lineItems[0].total)).toBe(1501);
    });

    it('records a payment against the invoice and keeps the ledger row', async () => {
      const { org, user } = await seedOrg('Alpha');
      const { booking } = await seedBooking(org.id);

      const response = await request(app, `/invoices/booking/${booking.id}/payment`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
        body: { amount: 2000, method: 'MPESA' },
      });

      expect(response.status).toBe(201);
      expect(Number(response.body.amountPaid)).toBe(2000);
      expect(response.body.payments).toHaveLength(1);

      const payments = await prisma.db.payment.count({ where: { invoiceId: response.body.id } });
      expect(payments).toBe(1);
    });

    it('does not leak org A booking invoices to org B', async () => {
      const alpha = await seedOrg('Alpha');
      const beta = await seedOrg('Beta');
      const { booking } = await seedBooking(alpha.org.id);

      // Org A legitimately creates the invoice first.
      const ownerRead = await request(app, `/invoices/booking/${booking.id}`, {
        orgId: alpha.org.id,
        userId: alpha.user.id,
      });
      expect(ownerRead.status).toBe(200);

      const response = await request(app, `/invoices/booking/${booking.id}`, {
        orgId: beta.org.id,
        userId: beta.user.id,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);

      const alphaInvoices = await prisma.db.invoice.count({
        where: { organizationId: alpha.org.id },
      });
      expect(alphaInvoices).toBe(1); // org A kept its own row, org B created none
      const betaInvoices = await prisma.db.invoice.count({
        where: { organizationId: beta.org.id },
      });
      expect(betaInvoices).toBe(0);
    });

    it('lets STAFF read but not issue an invoice (real RolesGuard)', async () => {
      const { org, user } = await seedOrg('Alpha', 'STAFF');
      const { booking } = await seedBooking(org.id);

      const read = await request(app, `/invoices/booking/${booking.id}`, {
        orgId: org.id,
        userId: user.id,
      });
      expect(read.status).toBe(200);

      const issue = await request(app, `/invoices/booking/${booking.id}/issue`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
      });
      expect(issue.status).toBe(403);
    });
  });

  describe('school fees', () => {
    async function seedSchool(label = 'School', role: 'OWNER' | 'STAFF' = 'OWNER') {
      const { org, user } = await seedOrg(label, role);
      const klass = await prisma.db.schoolClass.create({
        data: { organizationId: org.id, name: 'Form 1' },
      });
      const term = await prisma.db.academicTerm.create({
        data: {
          organizationId: org.id,
          name: 'Term 1 2026',
          startDate: new Date('2026-01-05T00:00:00.000Z'),
          endDate: new Date('2026-04-05T00:00:00.000Z'),
        },
      });
      await prisma.db.student.create({
        data: { organizationId: org.id, classId: klass.id, name: 'Alice', isActive: true },
      });
      await prisma.db.student.create({
        data: { organizationId: org.id, classId: klass.id, name: 'Bob', isActive: true },
      });
      await prisma.db.student.create({
        data: { organizationId: org.id, classId: klass.id, name: 'Inactive', isActive: false },
      });
      await prisma.db.feeStructure.create({
        data: {
          organizationId: org.id,
          termId: term.id,
          classId: klass.id,
          name: 'Tuition',
          amount: new Prisma.Decimal('10000.00'),
        },
      });
      await prisma.db.feeStructure.create({
        data: {
          organizationId: org.id,
          termId: term.id,
          classId: null,
          name: 'Activity',
          amount: new Prisma.Decimal('500.00'),
        },
      });
      return { org, user, klass, term };
    }

    it('generates one invoice per active student and is idempotent', async () => {
      const { org, user, term } = await seedSchool();

      const first = await request(app, `/school-fees/generate/${term.id}`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
      });
      expect(first.status).toBe(201);
      expect(first.body).toEqual({ created: 2, skipped: 0 });

      const second = await request(app, `/school-fees/generate/${term.id}`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
      });
      expect(second.body).toEqual({ created: 0, skipped: 2 });

      const listed = await request(app, `/school-fees/term/${term.id}`, {
        orgId: org.id,
        userId: user.id,
      });
      expect(listed.body).toHaveLength(2);
      expect(Number(listed.body[0].totalExpected)).toBe(10500);
    });

    it('applies a payment and reports the term summary + defaulters', async () => {
      const { org, user, term } = await seedSchool();
      await request(app, `/school-fees/generate/${term.id}`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
      });
      const listed = await request(app, `/school-fees/term/${term.id}`, {
        orgId: org.id,
        userId: user.id,
      });
      const invoiceId = listed.body[0].id;

      const issued = await request(app, `/school-fees/invoice/${invoiceId}/issue`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
      });
      expect(issued.status).toBe(201);

      const payment = await request(app, `/school-fees/invoice/${invoiceId}/payments`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
        body: { amount: 4000, method: 'MPESA' },
      });
      expect(payment.status).toBe(201);

      const detail = await request(app, `/school-fees/invoice/${invoiceId}`, {
        orgId: org.id,
        userId: user.id,
      });
      expect(Number(detail.body.amountPaid)).toBe(4000);
      expect(detail.body.status).toBe('PARTIAL');

      const summary = await request(app, `/school-fees/term/${term.id}/summary`, {
        orgId: org.id,
        userId: user.id,
      });
      expect(summary.body.totalExpected).toBe(21000);
      expect(summary.body.totalCollected).toBe(4000);
      expect(summary.body.outstanding).toBe(17000);

      const defaulters = await request(app, `/school-fees/term/${term.id}/defaulters`, {
        orgId: org.id,
        userId: user.id,
      });
      expect(defaulters.body).toHaveLength(2);
    });

    it('refuses to pay a DRAFT fee invoice', async () => {
      const { org, user, term } = await seedSchool();
      await request(app, `/school-fees/generate/${term.id}`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
      });
      const listed = await request(app, `/school-fees/term/${term.id}`, {
        orgId: org.id,
        userId: user.id,
      });

      const response = await request(app, `/school-fees/invoice/${listed.body[0].id}/payments`, {
        method: 'POST',
        orgId: org.id,
        userId: user.id,
        body: { amount: 100, method: 'CASH' },
      });
      expect(response.status).toBe(400);
    });

    it('does not leak org A fee invoices to org B', async () => {
      const alpha = await seedSchool('Alpha');
      const beta = await seedOrg('Beta');
      await request(app, `/school-fees/generate/${alpha.term.id}`, {
        method: 'POST',
        orgId: alpha.org.id,
        userId: alpha.user.id,
      });
      const listed = await request(app, `/school-fees/term/${alpha.term.id}`, {
        orgId: alpha.org.id,
        userId: alpha.user.id,
      });

      const response = await request(app, `/school-fees/invoice/${listed.body[0].id}`, {
        orgId: beta.org.id,
        userId: beta.user.id,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
