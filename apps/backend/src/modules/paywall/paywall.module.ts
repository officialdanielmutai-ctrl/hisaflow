import { Module } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AfricasTalkingProvider } from '../../infrastructure/providers/africas-talking.provider';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { AdminRoleGuard } from '../admin/guards/admin-role.guard';
import { PaystackService } from './paystack/paystack.service';
import { PaystackWebhookController } from './webhooks/paystack-webhook.controller';
import { PaystackWebhookService } from './webhooks/paystack-webhook.service';
import { PaystackEventHandlerService } from './webhooks/paystack-event-handler.service';
import { HisaflowPlansService } from './plans/hisaflow-plans.service';
import { PlansController } from './plans/plans.controller';
import { PaywallAdminController } from './plans/paywall-admin.controller';
import { CardSubscriptionService } from './subscriptions/card-subscription.service';
import { CardCheckoutService } from './subscriptions/card-checkout.service';
import { BillingService } from './subscriptions/billing.service';
import { PlanChangeJob } from './subscriptions/plan-change.job';
import { MpesaRenewalService } from './subscriptions/mpesa-renewal.service';
import { MpesaRenewalJob } from './subscriptions/mpesa-renewal.job';
import { MpesaCheckoutService } from './subscriptions/mpesa-checkout.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';

/**
 * HisaFlow Paywall / billing.
 *
 * Phase A: signature-verified, idempotent webhook receiver (Section 3.4).
 * Phase B: Paystack Plan provisioning, card checkout, and card-lifecycle
 * webhook consumption. Card (Paystack-native recurring) and M-Pesa (Phase C,
 * HisaFlow-owned scheduling) remain separate code paths by design.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [
    PaystackWebhookController,
    SubscriptionsController,
    PlansController,
    PaywallAdminController,
  ],
  providers: [
    PrismaService,
    PaystackService,
    PaystackWebhookService,
    PaystackEventHandlerService,
    HisaflowPlansService,
    CardSubscriptionService,
    CardCheckoutService,
    BillingService,
    PlanChangeJob,
    MpesaCheckoutService,
    MpesaRenewalService,
    MpesaRenewalJob,
    AfricasTalkingProvider,
    AdminAuthGuard,
    AdminRoleGuard,
  ],
  exports: [
    PaystackService,
    PaystackWebhookService,
    PaystackEventHandlerService,
    HisaflowPlansService,
    CardSubscriptionService,
    CardCheckoutService,
    BillingService,
    MpesaCheckoutService,
    MpesaRenewalService,
  ],
})
export class PaywallModule {}
