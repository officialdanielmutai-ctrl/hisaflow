import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ASSISTANT_TOOL_PROVIDERS,
  type AssistantToolProvider,
  type ToolContext,
  type ToolDefinition,
  type ToolSchema,
} from '../tool.types';

/**
 * The one place that answers "which capabilities exist and which is this org
 * allowed to be offered?". Capabilities are aggregated from every registered
 * provider (the shared foundation, DUKA, ISP, …). Adding a capability = adding
 * a tool to a provider, never editing a prompt. Identity fields are never part
 * of the schema.
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools: Map<string, ToolDefinition>;

  constructor(
    @Inject(ASSISTANT_TOOL_PROVIDERS)
    providers: AssistantToolProvider[],
  ) {
    this.tools = new Map(
      providers.flatMap((provider) => provider.all()).map((tool) => [tool.name, tool]),
    );
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  assertKnown(name: string): ToolDefinition {
    const tool = this.get(name);
    if (!tool) {
      throw new BadRequestException(`Unknown tool "${name}".`);
    }
    return tool;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Tools available to this org/role/vertical, before policy flags. */
  listFor(ctx: ToolContext): ToolDefinition[] {
    return this.list().filter((tool) => this.isAvailable(tool, ctx));
  }

  isAvailable(tool: ToolDefinition, ctx: ToolContext): boolean {
    if (
      tool.verticals &&
      tool.verticals.length > 0 &&
      !tool.verticals.includes(ctx.businessType)
    ) {
      return false;
    }
    if (tool.roles && tool.roles.length > 0 && !tool.roles.includes(ctx.role)) {
      return false;
    }
    if (
      ctx.isImpersonated &&
      (tool.kind === 'write' || tool.kind === 'communicate')
    ) {
      return false;
    }
    return true;
  }

  /** Model-facing tool list — identity fields are never exposed. */
  toSchemas(tools: ToolDefinition[]): ToolSchema[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}
