import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const org = await this.organizationsRepository.create({
      name: dto.name,
      businessType: dto.businessType,
      currency: dto.currency ?? 'KES',
      country: dto.country ?? 'KE',
      phone: dto.phone,
    });

    // Auto-generate a unique 6-character invite code
    const inviteCode = this.generateCode();
    await this.prisma.db.organization.update({
      where: { id: org.id },
      data: { inviteCode },
    });

    await this.prisma.db.orgMembership.create({
      data: {
        userId,
        organizationId: org.id,
        role: 'OWNER',
      },
    });

    return { ...org, inviteCode };
  }

  async findById(id: string) {
    const org = await this.organizationsRepository.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async getOrganizationsForUser(userId: string) {
    return this.organizationsRepository.findByMemberId(userId);
  }

  // ── Invite code: join an existing org ──────────────────────────────────────

  async joinOrganization(inviteCode: string, userId: string) {
    const org = await this.prisma.db.organization.findUnique({
      where: { inviteCode: inviteCode.toUpperCase().trim() },
    });

    if (!org) {
      throw new BadRequestException('Invalid invite code');
    }

    const existing = await this.prisma.db.orgMembership.findFirst({
      where: { userId, organizationId: org.id },
    });

    if (existing) {
      throw new BadRequestException('You are already a member of this organisation');
    }

    await this.prisma.db.orgMembership.create({
      data: { userId, organizationId: org.id, role: 'STAFF' },
    });

    return { message: 'Joined successfully', orgName: org.name };
  }

  // ── Invite code: let an owner retrieve their code ─────────────────────────

  async getMyInviteCode(userId: string) {
    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId, role: { in: ['OWNER', 'MANAGER'] } },
      include: { organization: { select: { inviteCode: true, name: true } } },
    });

    if (!membership) {
      throw new ForbiddenException('No organisation found for this user');
    }

    return {
      inviteCode: membership.organization.inviteCode,
      orgName: membership.organization.name,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }
}
