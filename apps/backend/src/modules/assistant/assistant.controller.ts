import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { RunToolDto } from './dto/run-tool.dto';
import { ProposeToolDto } from './dto/propose-tool.dto';
import { ListProposalsDto } from './dto/list-proposals.dto';

interface AuthenticatedUser {
  id: string;
  isImpersonated?: boolean;
}

@UseGuards(ClerkAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('tools')
  async tools(
    @OrgContext() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      tools: await this.assistant.listTools(
        orgId,
        user.id,
        Boolean(user.isImpersonated),
      ),
    };
  }

  @Post('tools/:name/run')
  async run(
    @Param('name') name: string,
    @Body() dto: RunToolDto,
    @OrgContext() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ctx = await this.assistant.buildContext(
      orgId,
      user.id,
      Boolean(user.isImpersonated),
    );
    return { result: await this.assistant.runReadTool(ctx, name, dto.args ?? {}) };
  }

  @Post('proposals')
  async propose(
    @Body() dto: ProposeToolDto,
    @OrgContext() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ctx = await this.assistant.buildContext(
      orgId,
      user.id,
      Boolean(user.isImpersonated),
    );
    return {
      proposal: await this.assistant.propose(ctx, dto.tool, dto.args ?? {}),
    };
  }

  @Get('proposals')
  async list(
    @OrgContext() orgId: string,
    @Query() query: ListProposalsDto,
  ) {
    return {
      proposals: await this.assistant.listProposals(orgId, query.status),
    };
  }

  @Post('proposals/:id/approve')
  async approve(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      proposal: await this.assistant.approve(orgId, id, user.id),
    };
  }

  @Post('proposals/:id/reject')
  async reject(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      proposal: await this.assistant.reject(orgId, id, user.id),
    };
  }

  @Post('proposals/:id/execute')
  async execute(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const ctx = await this.assistant.buildContext(
      orgId,
      user.id,
      Boolean(user.isImpersonated),
    );
    return this.assistant.execute(orgId, ctx, id);
  }
}
