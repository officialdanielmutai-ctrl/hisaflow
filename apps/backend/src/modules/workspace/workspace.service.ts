import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { UserWorkspace, WorkspaceLayout } from './workspace.types';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { tierAtLeast } from '../../core/entitlements/entitlements.constant';
import {
  validateLayoutInput,
  validateWorkspace,
  workspacePayloadBytes,
} from './lib/workspace-validation';
import {
  MAX_LAYOUTS_HARD_CAP,
  MAX_WORKSPACE_BYTES,
  PERSONAL_LAYOUT_LIMIT_FLOOR,
  WORKSPACE_SCHEMA_VERSION,
} from './workspace.constants';

const EMPTY_WORKSPACE: UserWorkspace = {
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeLayoutId: 'default',
  layouts: [],
  theme: { accent: 'emerald', mode: 'system', transparency: 0, blur: true },
  wallpaper: { type: 'preset', id: 'default' },
};

/**
 * Server-authoritative storage for a user's Home customisation.
 *
 * Every read validates the stored JSON before returning it, so a corrupted row
 * degrades to the default Home (null) instead of crashing. Every write
 * sanitiser-validates the payload, drops unknown/bad widget entries, enforces
 * the 64 KB cap and the plan's saved-layout limit. Tenant scoping is by
 * (userId, organizationId) on every query — a user can only ever read/write
 * their own workspace in the requesting org.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async get(organizationId: string, userId: string): Promise<UserWorkspace | null> {
    const row = await this.prisma.db.userWorkspace.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!row) return null;

    const result = validateWorkspace(row.data as unknown);
    if (!result.ok) return null;

    return { ...result.value, updatedAt: row.updatedAt.toISOString() };
  }

  async put(
    organizationId: string,
    userId: string,
    input: unknown,
  ): Promise<UserWorkspace> {
    if (workspacePayloadBytes(input) > MAX_WORKSPACE_BYTES) {
      throw new BadRequestException(
        `Workspace payload exceeds ${MAX_WORKSPACE_BYTES} bytes.`,
      );
    }

    const result = validateWorkspace(input);
    if (!result.ok) {
      throw new BadRequestException(result.errors.join(' '));
    }

    await this.assertLayoutLimit(organizationId, result.value.layouts.length);
    return this.save(organizationId, userId, result.value);
  }

  /**
   * `layout` restores the default arrangement (clears saved layouts) while
   * keeping theme and wallpaper. `all` deletes the stored workspace entirely,
   * so the next read returns null and Home paints its built-in default.
   */
  async reset(
    organizationId: string,
    userId: string,
    scope: 'layout' | 'all',
  ): Promise<UserWorkspace | null> {
    if (scope === 'all') {
      await this.prisma.db.userWorkspace.deleteMany({
        where: { organizationId, userId },
      });
      return null;
    }

    const current = await this.get(organizationId, userId);
    if (!current) return null;

    return this.save(organizationId, userId, {
      ...current,
      activeLayoutId: 'default',
      layouts: [],
    });
  }

  async createLayout(
    organizationId: string,
    userId: string,
    input: unknown,
  ): Promise<UserWorkspace> {
    const current = await this.getOrEmpty(organizationId, userId);
    const candidate = validateLayoutInput({
      ...(input as Record<string, unknown>),
      id: randomUUID(),
    });
    if (!candidate.ok) {
      throw new BadRequestException(candidate.errors.join(' '));
    }

    await this.assertLayoutLimit(organizationId, current.layouts.length + 1);
    return this.save(organizationId, userId, {
      ...current,
      activeLayoutId: candidate.value.id,
      layouts: [...current.layouts, candidate.value],
    });
  }

  async updateLayout(
    organizationId: string,
    userId: string,
    layoutId: string,
    input: unknown,
  ): Promise<UserWorkspace> {
    const current = await this.getOrEmpty(organizationId, userId);
    const existing = current.layouts.find((layout) => layout.id === layoutId);
    if (!existing) throw new NotFoundException('Layout not found.');

    const candidate = validateLayoutInput({
      id: existing.id,
      name: (input as Record<string, unknown>)?.name ?? existing.name,
      templateId:
        (input as Record<string, unknown>)?.templateId ?? existing.templateId,
      breakpoints:
        (input as Record<string, unknown>)?.breakpoints ?? existing.breakpoints,
    });
    if (!candidate.ok) {
      throw new BadRequestException(candidate.errors.join(' '));
    }

    return this.save(organizationId, userId, {
      ...current,
      layouts: current.layouts.map((layout) =>
        layout.id === layoutId ? candidate.value : layout,
      ),
    });
  }

  async deleteLayout(
    organizationId: string,
    userId: string,
    layoutId: string,
  ): Promise<UserWorkspace> {
    const current = await this.getOrEmpty(organizationId, userId);
    if (!current.layouts.some((layout) => layout.id === layoutId)) {
      throw new NotFoundException('Layout not found.');
    }

    const layouts = current.layouts.filter((layout) => layout.id !== layoutId);
    const activeLayoutId =
      current.activeLayoutId === layoutId
        ? (layouts[0]?.id ?? 'default')
        : current.activeLayoutId;

    return this.save(organizationId, userId, {
      ...current,
      activeLayoutId,
      layouts,
    });
  }

  async duplicateLayout(
    organizationId: string,
    userId: string,
    layoutId: string,
  ): Promise<UserWorkspace> {
    const current = await this.getOrEmpty(organizationId, userId);
    const existing = current.layouts.find((layout) => layout.id === layoutId);
    if (!existing) throw new NotFoundException('Layout not found.');

    await this.assertLayoutLimit(organizationId, current.layouts.length + 1);

    const copy: WorkspaceLayout = {
      ...existing,
      id: randomUUID(),
      name: this.copyName(existing.name),
    };

    return this.save(organizationId, userId, {
      ...current,
      activeLayoutId: copy.id,
      layouts: [...current.layouts, copy],
    });
  }

  private async getOrEmpty(
    organizationId: string,
    userId: string,
  ): Promise<UserWorkspace> {
    return (await this.get(organizationId, userId)) ?? { ...EMPTY_WORKSPACE };
  }

  private copyName(name: string): string {
    const suffix = ' copy';
    return `${name.slice(0, 60 - suffix.length)}${suffix}`;
  }

  private async assertLayoutLimit(
    organizationId: string,
    count: number,
  ): Promise<void> {
    const entitlements = await this.entitlements.resolve(organizationId);
    const allowed = tierAtLeast(entitlements.tier, 'TEAM')
      ? MAX_LAYOUTS_HARD_CAP
      : PERSONAL_LAYOUT_LIMIT_FLOOR;

    if (count > allowed) {
      throw new ForbiddenException(
        `Your plan allows up to ${allowed} saved layouts. ` +
          'Upgrade to Team for unlimited personal layouts.',
      );
    }
  }

  private async save(
    organizationId: string,
    userId: string,
    workspace: UserWorkspace,
  ): Promise<UserWorkspace> {
    const { updatedAt: _ignored, ...data } = workspace;
    const row = await this.prisma.db.userWorkspace.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: {
        userId,
        organizationId,
        schemaVersion: data.schemaVersion,
        data: data as unknown as Prisma.InputJsonValue,
      },
      update: {
        schemaVersion: data.schemaVersion,
        data: data as unknown as Prisma.InputJsonValue,
      },
    });

    return { ...data, updatedAt: row.updatedAt.toISOString() };
  }
}
