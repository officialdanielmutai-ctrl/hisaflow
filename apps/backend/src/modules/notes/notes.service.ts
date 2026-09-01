import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateNoteDto) {
    const note = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          organizationId,
          authorId: userId,
          title: dto.title,
          content: dto.content,
          importance: dto.importance ?? 'MEDIUM',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          checklistItems: dto.checklistItems?.length
            ? {
                create: dto.checklistItems.map((item, idx) => ({
                  text: item.text,
                  order: idx,
                })),
              }
            : undefined,
        },
        include: {
          checklistItems: { orderBy: { order: 'asc' } },
          author: { select: { name: true, clerkId: true } },
        },
      });

      // Write note restrictions if provided
      if (dto.restrictedUserIds?.length) {
        await tx.noteRestriction.createMany({
          data: dto.restrictedUserIds.map((uid) => ({
            noteId: created.id,
            userId: uid,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    // Send push notification for HIGH and CRITICAL notes (non-blocking)
    if (note.importance === 'HIGH' || note.importance === 'CRITICAL') {
      const importanceLabel = note.importance === 'CRITICAL' ? '🚨 Critical' : '⚠️ Important';
      this.notifications.sendPushToOrganization(organizationId, {
        title: `${importanceLabel}: ${note.title}`,
        body: note.content ?? 'A new important note has been left for the team.',
        url: '/notes',
      }).catch(() => {}); // Non-blocking — never fail the request
    }

    return note;
  }

  async findAll(
    organizationId: string,
    callerUserId: string,
    filters: { status?: string; from?: string; to?: string },
  ) {
    const callerRole = await this.getCallerRole(callerUserId, organizationId);

    const where: any = { organizationId };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.dueDate = {};
      if (filters.from) where.dueDate.gte = new Date(filters.from);
      if (filters.to) where.dueDate.lte = new Date(filters.to);
    }

    // OWNERs see all notes regardless of restrictions
    // Non-owners have notes restricted for them filtered out unless they are the author
    if (callerRole !== 'OWNER') {
      where.NOT = {
        restrictions: {
          some: {
            userId: callerUserId,
          },
        },
        authorId: { not: callerUserId },
      };
    }

    return this.prisma.db.note.findMany({
      where,
      include: {
        checklistItems: { orderBy: { order: 'asc' } },
        author: { select: { name: true, clerkId: true } },
        restrictions: { select: { userId: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { importance: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, organizationId: string, callerUserId: string) {
    const callerRole = await this.getCallerRole(callerUserId, organizationId);

    const note = await this.prisma.db.note.findFirst({
      where: { id, organizationId },
      include: {
        checklistItems: { orderBy: { order: 'asc' } },
        author: { select: { name: true, clerkId: true } },
        restrictions: { select: { userId: true } },
      },
    });

    if (!note) return null;

    // OWNERs and the note's own author always see it
    if (callerRole === 'OWNER' || note.authorId === callerUserId) {
      return note;
    }

    // Check if this note is restricted from the caller
    const isRestricted = note.restrictions.some((r) => r.userId === callerUserId);
    if (isRestricted) {
      throw new ForbiddenException('You do not have access to this note');
    }

    return note;
  }

  async update(id: string, organizationId: string, callerUserId: string, dto: UpdateNoteDto) {
    const updated = await this.prisma.db.$transaction(async (tx) => {
      const note = await tx.note.update({
        where: { id },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.content !== undefined && { content: dto.content }),
          ...(dto.importance && { importance: dto.importance }),
          ...(dto.status && { status: dto.status }),
          ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          }),
        },
        include: {
          checklistItems: { orderBy: { order: 'asc' } },
          author: { select: { name: true, clerkId: true } },
          restrictions: { select: { userId: true } },
        },
      });

      // If restrictedUserIds is explicitly provided, fully replace the restriction list
      if (dto.restrictedUserIds !== undefined) {
        await tx.noteRestriction.deleteMany({ where: { noteId: id } });
        if (dto.restrictedUserIds.length > 0) {
          await tx.noteRestriction.createMany({
            data: dto.restrictedUserIds.map((uid) => ({
              noteId: id,
              userId: uid,
            })),
            skipDuplicates: true,
          });
        }
      }

      return note;
    });

    return updated;
  }

  async remove(id: string, organizationId: string) {
    // NoteRestrictions cascade-delete via schema onDelete: Cascade
    await this.prisma.db.note.deleteMany({ where: { id, organizationId } });
    return { message: 'Note deleted' };
  }

  async addChecklistItem(noteId: string, organizationId: string, text: string) {
    const count = await this.prisma.db.checklistItem.count({ where: { noteId } });
    return this.prisma.db.checklistItem.create({
      data: { noteId, text, order: count },
    });
  }

  async toggleChecklistItem(itemId: string) {
    const item = await this.prisma.db.checklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('Checklist item not found');
    return this.prisma.db.checklistItem.update({
      where: { id: itemId },
      data: { isCompleted: !item.isCompleted },
    });
  }

  async deleteChecklistItem(itemId: string) {
    await this.prisma.db.checklistItem.delete({ where: { id: itemId } });
    return { message: 'Item deleted' };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async getCallerRole(userId: string, organizationId: string): Promise<string | null> {
    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId, organizationId },
      select: { role: true },
    });
    return membership?.role ?? null;
  }
}
