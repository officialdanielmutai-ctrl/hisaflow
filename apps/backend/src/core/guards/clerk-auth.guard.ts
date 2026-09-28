import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { PrismaService } from '../../infrastructure/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const impHeader = request.headers['x-impersonation-token'] as string | undefined;
    const header = request.headers.authorization;

    // Check for impersonation token in custom header or Bearer header
    const candidateToken =
      impHeader || (header && header.startsWith('Bearer ') ? header.split(' ')[1] : undefined);

    if (candidateToken) {
      try {
        const secret =
          this.configService.get<string>('ADMIN_IMPERSONATION_SECRET') ||
          this.configService.get<string>('clerk.secretKey') ||
          'impersonation-fallback-secret';

        const decoded = jwt.verify(candidateToken, secret) as any;

        if (decoded && decoded.readOnly === true && decoded.sub && decoded.targetOrgId) {
          const record = await this.prisma.db.impersonationToken.findUnique({
            where: { id: decoded.sub },
          });

          if (!record || record.revokedAt || record.expiresAt < new Date()) {
            throw new ForbiddenException('Impersonation session is expired or revoked');
          }

          // Enforce read-only constraint: reject mutations with 403 Forbidden
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            throw new ForbiddenException(
              'Mutations are disabled in Admin View-As (Read-Only) mode',
            );
          }

          request.headers['x-organization-id'] = decoded.targetOrgId;
          request.user = {
            id: decoded.adminId,
            clerkId: decoded.adminId,
            name: `${decoded.adminName} (View-As)`,
            role: 'OWNER',
            orgRole: 'org:admin',
            isImpersonated: true,
            readOnly: true,
            targetOrgId: decoded.targetOrgId,
            targetOrgName: decoded.targetOrgName,
          };
          return true;
        }
      } catch (jwtErr) {
        if (impHeader) {
          throw new UnauthorizedException('Invalid or expired impersonation token');
        }
      }
    }

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = header.split(' ')[1];

    try {
      const secretKey = this.configService.get<string>('clerk.secretKey');
      const payload = await verifyToken(token, { secretKey });
      const clerkId = payload.sub;

      let user = await this.prisma.db.user.findUnique({ where: { clerkId } });

      if (!user || !user.name) {
        // Fetch real name from Clerk and persist it so team lists show actual names
        try {
          const clerk = createClerkClient({ secretKey });
          const clerkUser = await clerk.users.getUser(clerkId);
          const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null;
          const email = clerkUser.emailAddresses[0]?.emailAddress || null;

          user = await this.prisma.db.user.upsert({
            where: { clerkId },
            update: { name, email },
            create: { clerkId, name, email },
          });
        } catch (nameErr) {
          // Non-fatal: fall back to upsert without name
          console.warn('Could not fetch Clerk user name:', nameErr);
          user = await this.prisma.db.user.upsert({
            where: { clerkId },
            update: {},
            create: { clerkId },
          });
        }
      }

      // Enrich with org role if x-organization-id header is present
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
      console.error('ClerkAuthGuard error:', e);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
