import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CardCheckoutService } from './card-checkout.service';
import { MpesaCheckoutService } from './mpesa-checkout.service';
import { BillingService } from './billing.service';
import { CardCheckoutDto } from './dto/card-checkout.dto';
import { MpesaCheckoutDto } from './dto/mpesa-checkout.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { UpdateSeatsDto } from './dto/update-seats.dto';
import { ChangePaymentMethodDto } from './dto/change-payment-method.dto';

/**
 * Org-facing subscription endpoints. Card checkout is Phase B; the billing
 * settings page reads `GET /paywall/subscription` for current plan/status.
 * Phase E adds self-serve plan/seat/payment-method changes and receipts.
 */
@Controller('paywall')
@UseGuards(ClerkAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly checkout: CardCheckoutService,
    private readonly mpesaCheckout: MpesaCheckoutService,
    private readonly billing: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('checkout')
  startCheckout(@OrgContext() organizationId: string, @Body() dto: CardCheckoutDto) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.checkout.start({
      organizationId,
      tier: dto.tier,
      email: dto.email,
      callbackUrl: dto.callbackUrl,
    });
  }

  @Post('checkout/mpesa')
  startMpesaCheckout(
    @OrgContext() organizationId: string,
    @Body() dto: MpesaCheckoutDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.mpesaCheckout.start({
      organizationId,
      tier: dto.tier,
      mpesaPhone: dto.mpesaPhone,
      email: dto.email,
      callbackUrl: dto.callbackUrl,
    });
  }

  @Get('subscription')
  async currentSubscription(@OrgContext() organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.prisma.db.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
  }

  /** Phase E: upgrade immediately, or schedule a downgrade for renewal. */
  @Post('change-plan')
  changePlan(
    @OrgContext() organizationId: string,
    @Body() dto: ChangePlanDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.billing.changePlan(organizationId, dto.tier);
  }

  /** Phase E: add/remove purchased seats above the tier's included allowance. */
  @Patch('seats')
  updateSeats(
    @OrgContext() organizationId: string,
    @Body() dto: UpdateSeatsDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.billing.updateSeats(organizationId, dto.additionalSeats);
  }

  /** Phase E: update card, M-Pesa number, or switch rails (new checkout). */
  @Post('payment-method')
  changePaymentMethod(
    @OrgContext() organizationId: string,
    @Body() dto: ChangePaymentMethodDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.billing.changePaymentMethod(
      organizationId,
      dto.method,
      dto.mpesaPhone,
    );
  }

  /** Phase E: receipt/invoice history from the payment-attempt audit trail. */
  @Get('invoices')
  listInvoices(@OrgContext() organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.billing.listInvoices(organizationId);
  }
}
