import { config } from 'dotenv';
import { resolve } from 'path';

// Load the committed, test-only environment before any Nest module is imported.
// dotenv does not override variables already set by the shell, so a caller can
// point DATABASE_URL at a different Postgres.
config({ path: resolve(__dirname, '..', '.env.test') });

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ClerkAuthGuard } from '../src/core/guards/clerk-auth.guard';
import { PrismaService } from '../src/infrastructure/prisma.service';

/**
 * Test-only auth guard for the seeded Duty 1 browser sweep.
 *
 * This file lives outside `src/`, so it is never part of `nest build` and can
 * never run in production. It accepts a synthetic bearer token of the form
 * `e2e.<clerkId>` and resolves the identity/role from the seeded database,
 * exactly like the real `ClerkAuthGuard` does after verifying a Clerk JWT.
 *
 * The server refuses to start unless `E2E_AUTH_BYPASS=true` and the process is
 * not a production build (checked in `bootstrap` below).
 */
@Injectable()
class E2eAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('No e2e token provided');
    }

    const token = header.slice('Bearer '.length);
    if (!token.startsWith('e2e.')) {
      throw new UnauthorizedException('Invalid e2e token');
    }
    const clerkId = token.slice('e2e.'.length);

    const user = await this.prisma.db.user.findUnique({ where: { clerkId } });
    if (!user) {
      throw new UnauthorizedException(`Unknown e2e user: ${clerkId}`);
    }

    const organizationId = request.headers['x-organization-id'] as
      | string
      | undefined;
    let role: string | null = null;
    if (organizationId && organizationId !== 'none') {
      const membership = await this.prisma.db.orgMembership.findFirst({
        where: { userId: user.id, organizationId },
        select: { role: true },
      });
      role = membership?.role ?? null;
    }

    request.user = {
      id: user.id,
      clerkId,
      name: user.name ?? null,
      role,
      orgRole: null,
    };
    return true;
  }
}

async function bootstrap(): Promise<void> {
  if (
    process.env.E2E_AUTH_BYPASS !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error(
      'Refusing to start the e2e server: E2E_AUTH_BYPASS must be "true" and NODE_ENV must not be "production".',
    );
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ClerkAuthGuard)
    .useClass(E2eAuthGuard)
    .compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-organization-id',
      'x-impersonation-token',
    ],
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[e2e-server] test auth enabled, listening on ${port}`);
}

void bootstrap();
