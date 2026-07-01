import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private isConfigured = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(
        'mailto:support@hisaflow.com',
        publicKey,
        privateKey
      );
      this.isConfigured = true;
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications are disabled.');
    }
  }

  async subscribe(userId: string, subscriptionInfo: any) {
    if (!subscriptionInfo || !subscriptionInfo.endpoint) {
      throw new Error('Invalid subscription payload');
    }
    
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscriptionInfo.endpoint },
      update: {
        userId,
        p256dh: subscriptionInfo.keys?.p256dh || '',
        auth: subscriptionInfo.keys?.auth || '',
      },
      create: {
        userId,
        endpoint: subscriptionInfo.endpoint,
        p256dh: subscriptionInfo.keys?.p256dh || '',
        auth: subscriptionInfo.keys?.auth || '',
      },
    });
  }

  async sendPushToOrganization(organizationId: string, payload: { title: string; body: string; url?: string }) {
    if (!this.isConfigured) return;

    // Find all users who are members of this organization
    const memberships = await this.prisma.orgMembership.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    const userIds = memberships.map((m) => m.userId);
    if (userIds.length === 0) return;

    // Find all subscriptions for these users
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    const pushPayload = JSON.stringify(payload);

    // Send push in parallel
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };
          await webpush.sendNotification(pushSubscription, pushPayload);
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or unsubscribed, clean it up
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            this.logger.error(`Failed to send push to sub ${sub.id}`, error);
          }
        }
      })
    );
  }
}
