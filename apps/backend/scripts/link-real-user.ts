import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma.service';

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'official.daniel.mutai@gmail.com';

async function main() {
  console.log('Booting NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService).db;

  // Find real user by email
  const realUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!realUser) {
    console.error('No real user found with email ' + OWNER_EMAIL + '. Sign into the app first.');
    await app.close(); process.exit(1);
  }
  console.log('Real user: ' + realUser.id + ' (' + realUser.clerkId + ')');

  // Find ALL stub users (clerkId starts with sim-)
  const allUsers = await prisma.user.findMany();
  const stubUsers = allUsers.filter((u: any) => u.clerkId.startsWith('sim-'));
  console.log('Found ' + stubUsers.length + ' stub user(s).');

  if (stubUsers.length === 0) {
    const count = await prisma.orgMembership.count({ where: { userId: realUser.id } });
    console.log('No stubs to merge. Real account has ' + count + ' org(s). Done.');
    await app.close(); process.exit(0);
  }

  const realMemberships = await prisma.orgMembership.findMany({ where: { userId: realUser.id } });
  const realOrgIds = new Set(realMemberships.map((m: any) => m.organizationId));

  let transferred = 0;
  let discarded = 0;

  for (const stubUser of stubUsers) {
    console.log('Processing stub: ' + stubUser.id + ' (' + stubUser.clerkId + ')');
    const stubMemberships = await prisma.orgMembership.findMany({ where: { userId: stubUser.id } });

    const toTransfer = stubMemberships.filter((m: any) => !realOrgIds.has(m.organizationId));
    const toDiscard  = stubMemberships.filter((m: any) =>  realOrgIds.has(m.organizationId));

    if (toDiscard.length > 0) {
      await prisma.orgMembership.deleteMany({ where: { id: { in: toDiscard.map((m: any) => m.id) } } });
      discarded += toDiscard.length;
    }
    if (toTransfer.length > 0) {
      await prisma.orgMembership.updateMany({
        where: { id: { in: toTransfer.map((m: any) => m.id) } },
        data: { userId: realUser.id },
      });
      transferred += toTransfer.length;
      // Track newly transferred orgs to avoid duplicates in next iteration
      toTransfer.forEach((m: any) => realOrgIds.add(m.organizationId));
    }

    await prisma.user.delete({ where: { id: stubUser.id } });
    console.log('Deleted stub: ' + stubUser.id);
  }

  const final = await prisma.orgMembership.count({ where: { userId: realUser.id } });
  console.log('Transferred: ' + transferred + ' | Discarded: ' + discarded);
  console.log('Done! Your real account now has ' + final + ' org(s). Refresh the app to see them all.');
  await app.close(); process.exit(0);
}

main().catch((err: any) => { console.error('Failed:', err); process.exit(1); });
