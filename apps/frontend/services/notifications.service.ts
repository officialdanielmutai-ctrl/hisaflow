import { apiPost } from '@/lib/api-client';

export async function subscribeToPushNotifications(
  token: string,
  organizationId: string,
  subscription: PushSubscription
): Promise<void> {
  await apiPost(
    '/notifications/subscribe',
    token,
    organizationId,
    subscription.toJSON()
  );
}
