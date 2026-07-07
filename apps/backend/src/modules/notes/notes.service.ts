import { Injectable } from '@nestjs/common';
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
    const note = await this.prisma.db.note.create({
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

    // Send push notification for HIGH and CRITICAL notes
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

  async findAll(organizationId: string, filters: { status?: string; from?: string; to?: string }) {
    const where: any = { organizationId };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.dueDate = {};
      if (filters.from) where.dueDate.gte = new Date(filters.from);
      if (filters.to) where.dueDate.lte = new Date(filters.to);
    }

    return this.prisma.db.note.findMany({
      where,
      include: {
        checklistItems: { orderBy: { order: 'asc' } },
        author: { select: { name: true, clerkId: true } },
      },
      orderBy: [
        { isPinned: 'desc' },
        { importance: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, organizationId: string) {
    return this.prisma.db.note.findFirst({
      where: { id, organizationId },
      include: {
        checklistItems: { orderBy: { order: 'asc' } },
        author: { select: { name: true, clerkId: true } },
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateNoteDto) {
    return this.prisma.db.note.update({
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
      },
    });
  }

  async remove(id: string, organizationId: string) {
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
}
