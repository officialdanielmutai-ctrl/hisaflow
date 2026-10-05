import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '../../src/config/config.module';
import { DatabaseModule } from '../../src/infrastructure/database/database.module';
import { EntitlementsModule } from '../../src/core/entitlements/entitlements.module';
import { CoreModule } from '../../src/core/core.module';
import { ClerkAuthGuard } from '../../src/core/guards/clerk-auth.guard';
import { PrismaService } from '../../src/infrastructure/prisma.service';
import { AlertsService } from '../../src/modules/alerts/alerts.service';
import { FinanceModule } from '../../src/modules/finance/finance.module';
import { InvoicesModule } from '../../src/modules/invoices/invoices.module';
import { SchoolFeesModule } from '../../src/modules/school-fees/school-fees.module';
import { TransactionsModule } from '../../src/modules/transactions/transactions.module';
import { TieredPricingModule } from '../../src/modules/tiered-pricing/tiered-pricing.module';
import { StockBatchesModule } from '../../src/modules/stock-batches/stock-batches.module';

/**
 * Replaces Clerk token verification with a header-driven stub. The real
 * `RolesGuard` is deliberately left in place so role checks still run against
 * the database. Tokens are covered by the dedicated guard unit tests.
 */
const testAuthGuard = {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-test-user-id'] as string | undefined;
    if (!userId) throw new UnauthorizedException('Missing x-test-user-id header');
    request.user = {
      id: userId,
      clerkId: userId,
      name: 'E2E User',
      role: request.headers['x-test-role'] ?? 'OWNER',
    };
    return true;
  },
};

export async function createE2eApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule,
      CoreModule,
      DatabaseModule,
      EntitlementsModule,
      FinanceModule,
      InvoicesModule,
      SchoolFeesModule,
      TransactionsModule,
      TieredPricingModule,
      StockBatchesModule,
    ],
  })
    .overrideGuard(ClerkAuthGuard)
    .useValue(testAuthGuard)
    .overrideProvider(AlertsService)
    .useValue({ runAllChecks: async () => ({ ok: true }) })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  return app;
}

export function baseUrl(app: INestApplication): string {
  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

export interface E2eRequest {
  method?: string;
  orgId?: string;
  userId?: string;
  role?: string;
  body?: unknown;
}

export async function request(
  app: INestApplication,
  path: string,
  options: E2eRequest = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.orgId) headers['x-organization-id'] = options.orgId;
  if (options.userId) headers['x-test-user-id'] = options.userId;
  if (options.role) headers['x-test-role'] = options.role;

  const response = await fetch(`${baseUrl(app)}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

/** Truncates every application table, leaving Prisma's migration table alone. */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.db.$executeRawUnsafe(`
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
