import { Controller, Get, Post, Body, Param, Headers, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { MessagesService } from './messages.service';
import { AccessMessageDto } from './dto/access-message.dto';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@Controller('admin/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @Post('access')
  async requestAccess(@Body() dto: AccessMessageDto, @Req() req: any) {
    return this.messagesService.requestAccess(
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @Get('access-logs')
  async getAccessLogs() {
    return this.messagesService.getAccessLogs();
  }

  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @Get(':orgId/conversations')
  async listConversations(
    @Param('orgId') orgId: string,
    @Headers('x-message-access-token') token: string,
  ) {
    if (!token) {
      throw new ForbiddenException(
        'Observability access denied: Missing x-message-access-token header. Please complete reason prompt first.',
      );
    }
    return this.messagesService.listConversations(orgId, token);
  }

  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @Get(':orgId/conversations/:convId')
  async getConversationMessages(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Headers('x-message-access-token') token: string,
  ) {
    if (!token) {
      throw new ForbiddenException(
        'Observability access denied: Missing x-message-access-token header. Please complete reason prompt first.',
      );
    }
    return this.messagesService.getConversationMessages(orgId, convId, token);
  }
}
