import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminRole } from '@prisma/client';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('No admin authorization token provided');
    }

    const token = header.split(' ')[1];

    try {
      const secretKey =
        this.configService.get<string>('clerk.adminSecretKey') ||
        this.configService.get<string>('clerk.secretKey') ||
        process.env.CLERK_SECRET_KEY;

      const payload = await verifyToken(token, { secretKey });
      const clerkId = payload.sub;

      if (!clerkId) {
        throw new UnauthorizedException('Token does not contain a valid subject');
      }

      let adminUser = await this.prisma.db.adminUser.findUnique({
        where: { clerkId },
      });

      // Auto-bootstrap first admin if none exists
      if (!adminUser) {
        const totalAdmins = await this.prisma.db.adminUser.count();
        if (totalAdmins === 0) {
          try {
            const clerk = createClerkClient({ secretKey });
            const clerkUser = await clerk.users.getUser(clerkId);
            const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Super Admin';
            const email = clerkUser.emailAddresses[0]?.emailAddress || `${clerkId}@admin.hisaflow.com`;

            adminUser = await this.prisma.db.adminUser.create({
              data: {
                clerkId,
                email,
                name,
                role: AdminRole.SUPER_ADMIN,
                isActive: true,
              },
            });
            this.logger.log(`Auto-bootstrapped first Super Admin: ${email} (${clerkId})`);
          } catch (bootstrapErr) {
            this.logger.error('Failed to auto-bootstrap first admin:', bootstrapErr);
          }
        }
      }

      if (!adminUser || !adminUser.isActive) {
        throw new UnauthorizedException('Admin access denied: Account not registered or inactive');
      }

      request.adminUser = adminUser;
      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.warn(`Admin token verification failed: ${err?.message}`);
      throw new UnauthorizedException('Invalid or expired admin session token');
    }
  }
}
