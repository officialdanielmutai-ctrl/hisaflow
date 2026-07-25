import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken, clerkClient } from '@clerk/backend';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = header.split(' ')[1];

    try {
      const payload = await verifyToken(token, {
        secretKey: this.configService.get<string>('clerk.secretKey'),
      });

      const clerkId = payload.sub;

      let user = await this.prisma.db.user.findUnique({ where: { clerkId } });

      if (!user || !user.name) {
        // Fetch user from clerk to populate name/email
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null;
        const email = clerkUser.emailAddresses[0]?.emailAddress || null;
        
        user = await this.prisma.db.user.upsert({
          where: { clerkId },
          update: { name, email },
          create: { clerkId, name, email },
        });
      }

      // Optionally enrich with org role if x-organization-id header is present
      const organizationId = request.headers['x-organization-id'] as string | undefined;
      let orgRole: string | null = null;
      if (organizationId) {
        const membership = await this.prisma.db.orgMembership.findFirst({
          where: { userId: user.id, organizationId },
          select: { role: true },
        });
        orgRole = membership?.role ?? null;
      }

      request.user = {
        id: user.id,
        clerkId,
        name: user.name ?? null,
        role: orgRole,
        orgRole: (payload as any).org_role ?? null,
      };
      return true;
    } catch (e) {
      console.error("Clerk Guard Error:", e);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
