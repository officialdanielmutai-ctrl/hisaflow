import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../../infrastructure/prisma.service';
import {
  AppPermission,
  computeEffectivePermissions,
} from '../../core/constants/permissions.constant';

@Injectable()
export class StaffAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ── Step helpers ──────────────────────────────────────────────────────────

  /** Confirms the calling user is the OWNER of the given org. Throws otherwise. */
  private async assertOwner(callerUserId: string, orgId: string): Promise<void> {
    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId: callerUserId, organizationId: orgId, role: 'OWNER' },
    });
    if (!membership) {
      throw new ForbiddenException('Only the organisation owner can perform this action');
    }
  }

  /** Confirms the target user exists in the org and is not the caller (owner cannot remove themselves). */
  private async assertRemovable(
    targetUserId: string,
    orgId: string,
    callerUserId: string,
  ): Promise<void> {
    if (targetUserId === callerUserId) {
      throw new BadRequestException('You cannot remove yourself from the organisation');
    }
    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId: targetUserId, organizationId: orgId },
    });
    if (!membership) {
      throw new NotFoundException('Staff member not found in this organisation');
    }
  }

  /** Deletes the OrgMembership record. Leaves User row, notes, and transactions intact for attribution. */
  private async deleteMembership(targetUserId: string, orgId: string): Promise<void> {
    await this.prisma.db.orgMembership.deleteMany({
      where: { userId: targetUserId, organizationId: orgId },
    });
  }

  /** Enumerates and revokes all active Clerk sessions for the given clerkId. */
  private async revokeUserClerkSessions(clerkId: string): Promise<void> {
    const secretKey = this.configService.get<string>('clerk.secretKey');
    const clerk = createClerkClient({ secretKey });

    try {
      const sessions = await clerk.sessions.getSessionList({ userId: clerkId, status: 'active' });
      await Promise.all(
        sessions.data.map((session) => clerk.sessions.revokeSession(session.id)),
      );
    } catch (err) {
      // Non-fatal: membership is already deleted. Log and continue.
      console.warn(`[StaffAdminService] Could not revoke Clerk sessions for ${clerkId}:`, err);
    }
  }

  // ── Public methods ────────────────────────────────────────────────────────

  /**
   * Returns all staff members in the org along with their effective permissions.
   * Accessible by OWNER and MANAGER.
   */
  async getStaffMembers(callerUserId: string, orgId: string) {
    const callerMembership = await this.prisma.db.orgMembership.findFirst({
      where: { userId: callerUserId, organizationId: orgId, role: { in: ['OWNER', 'MANAGER'] } },
    });
    if (!callerMembership) {
      throw new ForbiddenException('Not authorised');
    }

    const members = await this.prisma.db.orgMembership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, clerkId: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      userId: m.userId,
      clerkId: m.user.clerkId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
      grantedPermissions: m.grantedPermissions,
      revokedPermissions: m.revokedPermissions,
      effectivePermissions: computeEffectivePermissions(
        m.role,
        m.grantedPermissions,
        m.revokedPermissions,
      ),
    }));
  }

  /**
   * Permanently removes a staff member from the org.
   * Composed of: assertOwner → assertRemovable → deleteMembership → revokeUserClerkSessions.
   */
  async removeStaff(callerUserId: string, targetUserId: string, orgId: string): Promise<void> {
    await this.assertOwner(callerUserId, orgId);
    await this.assertRemovable(targetUserId, orgId, callerUserId);

    // Look up clerkId before deleting the membership
    const targetUser = await this.prisma.db.user.findUnique({
      where: { id: targetUserId },
      select: { clerkId: true },
    });

    await this.deleteMembership(targetUserId, orgId);

    if (targetUser) {
      await this.revokeUserClerkSessions(targetUser.clerkId);
    }
  }

  /**
   * Updates the grantedPermissions and revokedPermissions for a staff member.
   * `canManageStaff` cannot be granted via override — only implicit to OWNER.
   */
  async updatePermissions(
    callerUserId: string,
    targetUserId: string,
    orgId: string,
    grantedPermissions: string[],
    revokedPermissions: string[],
  ) {
    await this.assertOwner(callerUserId, orgId);

    // Validate all provided keys are real permissions
    const validKeys = Object.values(AppPermission);
    const allProvided = [...grantedPermissions, ...revokedPermissions];
    const invalid = allProvided.filter((p) => !validKeys.includes(p as AppPermission));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid permission keys: ${invalid.join(', ')}`);
    }

    // canManageStaff cannot be granted via override
    if (grantedPermissions.includes(AppPermission.canManageStaff)) {
      throw new BadRequestException('canManageStaff is implicit to OWNER and cannot be granted via override');
    }

    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId: targetUserId, organizationId: orgId },
    });
    if (!membership) {
      throw new NotFoundException('Staff member not found in this organisation');
    }

    const updated = await this.prisma.db.orgMembership.update({
      where: { id: membership.id },
      data: { grantedPermissions, revokedPermissions },
      include: { user: { select: { name: true, email: true } } },
    });

    return {
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      grantedPermissions: updated.grantedPermissions,
      revokedPermissions: updated.revokedPermissions,
      effectivePermissions: computeEffectivePermissions(
        updated.role,
        updated.grantedPermissions,
        updated.revokedPermissions,
      ),
    };
  }
}
