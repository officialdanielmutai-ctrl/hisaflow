import { ForbiddenException, Injectable } from '@nestjs/common';
import { EntitlementsService } from '../../../core/entitlements/entitlements.service';
import type { ToolContext, ToolDefinition, ToolKind } from '../tool.types';
import { ASSISTANT_FLAGS, FeatureFlagService } from './feature-flag.service';

/**
 * Policy is enforced in application code at the execution layer, not in the
 * prompt. The model never supplies identity; the server injects it. Default is
 * deny: an unknown/disabled flag blocks the tool.
 */
@Injectable()
export class AssistantPolicyService {
  constructor(
    private readonly flags: FeatureFlagService,
    private readonly entitlements: EntitlementsService,
  ) {}

  kindFlag(kind: ToolKind): string {
    switch (kind) {
      case 'write':
        return ASSISTANT_FLAGS.write;
      case 'communicate':
        return ASSISTANT_FLAGS.communicate;
      case 'read':
      case 'utility':
      default:
        return ASSISTANT_FLAGS.read;
    }
  }

  async assertToolAllowed(
    tool: ToolDefinition,
    ctx: ToolContext,
  ): Promise<void> {
    if (
      ctx.isImpersonated &&
      (tool.kind === 'write' || tool.kind === 'communicate')
    ) {
      throw new ForbiddenException(
        'Mutations are disabled in Admin View-As (Read-Only) mode',
      );
    }

    if (
      tool.verticals &&
      tool.verticals.length > 0 &&
      !tool.verticals.includes(ctx.businessType)
    ) {
      throw new ForbiddenException(
        `Tool "${tool.name}" is not available for this business type.`,
      );
    }

    if (tool.roles && tool.roles.length > 0 && !tool.roles.includes(ctx.role)) {
      throw new ForbiddenException(`Your role cannot use "${tool.name}".`);
    }

    if (tool.feature) {
      await this.entitlements.assertFeatures(ctx.organizationId, [tool.feature]);
    }

    await this.flags.assertEnabled(this.kindFlag(tool.kind), {
      organizationId: ctx.organizationId,
      businessType: ctx.businessType,
    });
  }
}
