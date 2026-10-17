import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { WorkspaceService } from './workspace.service';
import { WORKSPACE_SCHEMA_VERSION } from './workspace.constants';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const USER = 'user_a';
const OTHER_USER = 'user_b';
const NOW = new Date('2026-10-17T09:00:00.000Z');

function layout(id = 'layout_1', name = 'My layout') {
  return {
    id,
    name,
    breakpoints: {
      desktop: [
        { instanceId: 'inst_1', widgetId: 'today-sales', size: 'M', order: 0 },
      ],
      tablet: [],
      mobile: [],
    },
  };
}

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeLayoutId: 'layout_1',
    layouts: [layout()],
    theme: { accent: 'blue', mode: 'dark', transparency: 10, blur: true },
    wallpaper: { type: 'preset', id: 'mist' },
    ...overrides,
  };
}

function build(
  opts: { row?: unknown; tier?: 'SOLO' | 'TEAM' | 'GROWTH' } = {},
) {
  const findUnique = jest.fn(async (_args?: unknown) => opts.row ?? null);
  const upsert = jest.fn(async ({ create, update }: any) => ({
    ...create,
    ...update,
    updatedAt: NOW,
  }));
  const deleteMany = jest.fn(async (_args?: unknown) => ({ count: 1 }));
  const db: any = { userWorkspace: { findUnique, upsert, deleteMany } };

  const entitlements = {
    resolve: jest.fn(async () => ({ tier: opts.tier ?? 'TEAM' })),
  };

  const service = new WorkspaceService(
    { db } as unknown as PrismaService,
    entitlements as unknown as EntitlementsService,
  );

  return { service, findUnique, upsert, deleteMany, entitlements };
}

function saved(value: unknown) {
  return { id: 'ws_1', userId: USER, organizationId: ORG, data: value, updatedAt: NOW };
}

describe('WorkspaceService', () => {
  it('returns null when the user has never saved a workspace', async () => {
    const { service, findUnique } = build();

    await expect(service.get(ORG, USER)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: USER, organizationId: ORG } },
    });
  });

  it('returns the validated workspace with the server timestamp', async () => {
    const { service } = build({ row: saved(workspace()) });

    const result = await service.get(ORG, USER);

    expect(result).toMatchObject({
      activeLayoutId: 'layout_1',
      updatedAt: NOW.toISOString(),
    });
    expect(result?.layouts).toHaveLength(1);
  });

  it('degrades a corrupt stored row to the default Home (null)', async () => {
    const { service } = build({ row: saved({ nope: true }) });

    await expect(service.get(ORG, USER)).resolves.toBeNull();
  });

  it('rejects an oversized payload before touching the database', async () => {
    const { service, upsert } = build();

    await expect(
      service.put(ORG, USER, workspace({ activeLayoutId: 'x'.repeat(70 * 1024) })),
    ).rejects.toThrow(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects structurally invalid input', async () => {
    const { service, upsert } = build();

    await expect(service.put(ORG, USER, { layouts: 'nope' })).rejects.toThrow(
      BadRequestException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts scoped to the requesting user and organisation', async () => {
    const { service, upsert } = build({ tier: 'TEAM' });

    const result = await service.put(ORG, USER, workspace());

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_organizationId: { userId: USER, organizationId: ORG } },
        create: expect.objectContaining({ userId: USER, organizationId: ORG }),
      }),
    );
    expect(result.updatedAt).toBe(NOW.toISOString());
  });

  it('enforces the 3-layout floor on SOLO but allows more on TEAM', async () => {
    const fourLayouts = workspace({
      layouts: [layout('l1'), layout('l2'), layout('l3'), layout('l4')],
    });

    const solo = build({ tier: 'SOLO' });
    await expect(solo.service.put(ORG, USER, fourLayouts)).rejects.toThrow(
      ForbiddenException,
    );

    const threeLayouts = workspace({
      layouts: [layout('l1'), layout('l2'), layout('l3')],
    });
    await expect(solo.service.put(ORG, USER, threeLayouts)).resolves.toBeTruthy();

    const team = build({ tier: 'TEAM' });
    await expect(team.service.put(ORG, USER, fourLayouts)).resolves.toBeTruthy();
  });

  it('reset("all") deletes only this user/org row and returns null', async () => {
    const { service, deleteMany } = build();

    await expect(service.reset(ORG, USER, 'all')).resolves.toBeNull();
    expect(deleteMany).toHaveBeenCalledWith({ where: { organizationId: ORG, userId: USER } });
  });

  it('reset("layout") clears layouts but keeps theme and wallpaper', async () => {
    const { service, upsert } = build({ row: saved(workspace()) });

    const result = await service.reset(ORG, USER, 'layout');

    expect(result?.layouts).toEqual([]);
    expect(result?.activeLayoutId).toBe('default');
    expect(result?.theme).toMatchObject({ accent: 'blue', mode: 'dark' });
    expect(result?.wallpaper).toEqual({ type: 'preset', id: 'mist' });
    expect(upsert).toHaveBeenCalled();
  });

  it('creates a layout with a server-generated id and makes it active', async () => {
    const { service, upsert } = build({ tier: 'TEAM' });

    const result = await service.createLayout(ORG, USER, {
      name: '  Operations  ',
      breakpoints: { desktop: [], tablet: [], mobile: [] },
    });

    const created = result.layouts[result.layouts.length - 1];
    expect(created.name).toBe('Operations');
    expect(created.id).toBeTruthy();
    expect(created.id).not.toBe('layout_1');
    expect(result.activeLayoutId).toBe(created.id);
    expect(upsert).toHaveBeenCalled();
  });

  it('blocks creating a fourth layout on SOLO', async () => {
    const row = saved(
      workspace({
        layouts: [layout('l1'), layout('l2'), layout('l3')],
      }),
    );
    const { service } = build({ row, tier: 'SOLO' });

    await expect(
      service.createLayout(ORG, USER, { name: 'Fourth' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates an existing layout and 404s a missing one', async () => {
    const { service } = build({ row: saved(workspace()) });

    const updated = await service.updateLayout(ORG, USER, 'layout_1', {
      name: 'Renamed',
    });
    expect(updated.layouts[0].name).toBe('Renamed');

    await expect(
      service.updateLayout(ORG, USER, 'missing', { name: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes a layout and moves the active id to a remaining layout', async () => {
    const row = saved(
      workspace({
        activeLayoutId: 'l2',
        layouts: [layout('l1'), layout('l2')],
      }),
    );
    const { service } = build({ row });

    const result = await service.deleteLayout(ORG, USER, 'l2');

    expect(result.layouts.map((l) => l.id)).toEqual(['l1']);
    expect(result.activeLayoutId).toBe('l1');
  });

  it('duplicates a layout with a new id and a "copy" name', async () => {
    const { service } = build({ row: saved(workspace()), tier: 'TEAM' });

    const result = await service.duplicateLayout(ORG, USER, 'layout_1');

    expect(result.layouts).toHaveLength(2);
    const copy = result.layouts[1];
    expect(copy.id).not.toBe('layout_1');
    expect(copy.name).toBe('My layout copy');
    expect(result.activeLayoutId).toBe(copy.id);
  });

  it('scopes each read to the requesting org/user (no cross-tenant access)', async () => {
    const { service, findUnique } = build({ row: saved(workspace()) });

    await service.get(ORG, USER);
    await service.get(OTHER_ORG, OTHER_USER);

    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: { userId_organizationId: { userId: USER, organizationId: ORG } },
    });
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        userId_organizationId: { userId: OTHER_USER, organizationId: OTHER_ORG },
      },
    });
  });
});
