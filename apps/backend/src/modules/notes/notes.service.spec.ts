import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotesService } from './notes.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { role?: string; note?: any } = {}) {
  const noteCreate = jest.fn(async ({ data }: any) => ({
    id: 'note_new',
    importance: data.importance,
    title: data.title,
    content: data.content,
    authorId: data.authorId,
    ...data,
  }));
  const noteRestriction = {
    createMany: jest.fn(async (_args?: any) => ({ count: 1 })),
    deleteMany: jest.fn(async (_args?: any) => ({ count: 0 })),
  };
  const note = {
    create: noteCreate,
    findMany: jest.fn(async (_args?: any) => [{ id: 'note_1', organizationId: ORG }]),
    findFirst: jest.fn(async (_args?: any) => opts.note ?? null),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    deleteMany: jest.fn(async () => ({ count: 1 })),
  };
  const checklistItem = {
    count: jest.fn(async () => 2),
    create: jest.fn(async ({ data }: any) => ({ id: 'ci_new', ...data })),
    findUnique: jest.fn(async ({ where }: any): Promise<any> => ({ id: where.id, isCompleted: false })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
  };
  const orgMembership = {
    findFirst: jest.fn(async () => ({ role: opts.role ?? 'STAFF' })),
  };
  const tx = { note: { create: noteCreate, update: note.update }, noteRestriction };
  const $transaction = jest.fn(async (cb: any) => cb(tx));
  const db: any = { note, noteRestriction, checklistItem, orgMembership, $transaction };
  const notifications = {
    sendPushToOrganization: jest.fn(async () => undefined),
  } as unknown as NotificationsService;
  const service = new NotesService({ db } as unknown as PrismaService, notifications);
  return { service, note, noteRestriction, checklistItem, orgMembership, notifications, $transaction };
}

describe('NotesService — create', () => {
  it('creates a note with checklist items and restrictions in one transaction', async () => {
    const { service, noteRestriction, $transaction } = build();

    await service.create(ORG, 'user_1', {
      title: 'Stock count',
      content: 'Do it',
      importance: 'HIGH',
      checklistItems: [{ text: 'Count sugar' }, { text: 'Count salt' }],
      restrictedUserIds: ['user_2'],
    } as any);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(noteRestriction.createMany).toHaveBeenCalledTimes(1);
    const created = noteRestriction.createMany.mock.calls[0][0];
    expect(created.data[0]).toEqual({ noteId: 'note_new', userId: 'user_2' });
  });

  it('pushes a notification for a HIGH note', async () => {
    const { service, notifications } = build();

    await service.create(ORG, 'user_1', { title: 'Urgent', content: 'x', importance: 'HIGH' } as any);

    expect(notifications.sendPushToOrganization).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ title: expect.stringContaining('Urgent'), url: '/notes' }),
    );
  });

  it('does not push for a LOW importance note', async () => {
    const { service, notifications } = build();

    await service.create(ORG, 'user_1', { title: 'FYI', content: 'x', importance: 'LOW' } as any);

    expect(notifications.sendPushToOrganization).not.toHaveBeenCalled();
  });
});

describe('NotesService — visibility', () => {
  it('lets an OWNER see all notes without a restriction filter', async () => {
    const { service, note } = build({ role: 'OWNER' });

    await service.findAll(ORG, 'owner_1', {});

    const where = note.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: ORG });
    expect(where.NOT).toBeUndefined();
  });

  it('filters restricted notes out for a non-owner', async () => {
    const { service, note } = build({ role: 'STAFF' });

    await service.findAll(ORG, 'staff_1', { status: 'OPEN' });

    const where = note.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG);
    expect(where.status).toBe('OPEN');
    expect(where.NOT).toEqual({
      restrictions: { some: { userId: 'staff_1' } },
      authorId: { not: 'staff_1' },
    });
  });

  it('returns a restricted note to its author', async () => {
    const { service } = build({
      role: 'STAFF',
      note: { id: 'note_1', organizationId: ORG, authorId: 'staff_1', restrictions: [{ userId: 'staff_1' }] },
    });

    await expect(service.findOne('note_1', ORG, 'staff_1')).resolves.toMatchObject({ id: 'note_1' });
  });

  it('blocks a non-author from a note restricted for them', async () => {
    const { service } = build({
      role: 'STAFF',
      note: { id: 'note_1', organizationId: ORG, authorId: 'user_9', restrictions: [{ userId: 'staff_1' }] },
    });

    await expect(service.findOne('note_1', ORG, 'staff_1')).rejects.toThrow(ForbiddenException);
  });

  it('returns null for a note that does not exist', async () => {
    const { service } = build({ note: null });

    await expect(service.findOne('missing', ORG, 'user_1')).resolves.toBeNull();
  });
});

describe('NotesService — mutations', () => {
  it('scopes delete to the org', async () => {
    const { service, note } = build();

    await service.remove('note_1', ORG);

    expect(note.deleteMany).toHaveBeenCalledWith({ where: { id: 'note_1', organizationId: ORG } });
  });

  it('replaces the restriction list on update', async () => {
    const { service, noteRestriction } = build();

    await service.update('note_1', ORG, 'user_1', { restrictedUserIds: ['user_2'] } as any);

    expect(noteRestriction.deleteMany).toHaveBeenCalledWith({ where: { noteId: 'note_1' } });
    expect(noteRestriction.createMany).toHaveBeenCalledTimes(1);
  });

  it('BUG (reported, not fixed): update does not scope the write to the organisation', async () => {
    // notes.service.ts update() calls tx.note.update({ where: { id } }) without
    // organizationId, so any org can mutate another org's note by id. Pinned here.
    const { service, note } = build();

    await service.update('note_1', OTHER_ORG, 'user_1', { title: 'Hijacked' } as any);

    expect(note.update.mock.calls[0][0].where).toEqual({ id: 'note_1' });
    expect(note.update.mock.calls[0][0].where.organizationId).toBeUndefined();
  });

  it('appends a checklist item at the next order position', async () => {
    const { service, checklistItem } = build();

    await service.addChecklistItem('note_1', ORG, 'Count rice');

    expect(checklistItem.count).toHaveBeenCalledWith({ where: { noteId: 'note_1' } });
    expect(checklistItem.create.mock.calls[0][0].data).toEqual({
      noteId: 'note_1',
      text: 'Count rice',
      order: 2,
    });
  });

  it('toggles a checklist item', async () => {
    const { service, checklistItem } = build();

    await service.toggleChecklistItem('ci1');

    expect(checklistItem.update.mock.calls[0][0].data).toEqual({ isCompleted: true });
  });

  it('throws when toggling a missing checklist item', async () => {
    const { service, checklistItem } = build();
    checklistItem.findUnique.mockResolvedValueOnce(null);

    await expect(service.toggleChecklistItem('missing')).rejects.toThrow('Checklist item not found');
  });

  it('deletes a checklist item', async () => {
    const { service, checklistItem } = build();

    await service.deleteChecklistItem('ci1');

    expect(checklistItem.delete).toHaveBeenCalledWith({ where: { id: 'ci1' } });
  });
});
