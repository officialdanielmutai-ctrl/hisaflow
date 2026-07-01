import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@Controller('notifications')
@UseGuards(ClerkAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: { id: string; clerkId: string },
    @Body() subscription: any,
  ) {
    await this.notificationsService.subscribe(user.id, subscription);
    return { success: true };
  }

  @Post('test')
  async testPush(
    @OrgContext() organizationId: string,
  ) {
    await this.notificationsService.sendPushToOrganization(organizationId, {
      title: '🎉 HisaFlow Notifications Working!',
      body: 'Your device is successfully receiving real-time alerts from HisaFlow.',
      url: '/alerts',
    });
    return { success: true };
  }
}
