import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@Controller('invoices')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('booking/:bookingId')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  getDraft(
    @OrgContext() orgId: string,
    @Param('bookingId') bookingId: string
  ) {
    return this.invoicesService.getDraftForBooking(orgId, bookingId);
  }

  @Post('booking/:bookingId/issue')
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  issue(
    @OrgContext() orgId: string,
    @Param('bookingId') bookingId: string
  ) {
    return this.invoicesService.issue(orgId, bookingId);
  }

  @Post('booking/:bookingId/void')
  @Roles(AppRole.OWNER)
  void(
    @OrgContext() orgId: string,
    @Param('bookingId') bookingId: string
  ) {
    return this.invoicesService.void(orgId, bookingId);
  }

  @Post('booking/:bookingId/line-items')
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  addLineItem(
    @OrgContext() orgId: string,
    @Param('bookingId') bookingId: string,
    @Body() createInvoiceLineItemDto: CreateInvoiceLineItemDto
  ) {
    return this.invoicesService.addLineItem(orgId, bookingId, createInvoiceLineItemDto);
  }

  @Post('booking/:bookingId/payment')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  addPayment(
    @OrgContext() orgId: string,
    @Param('bookingId') bookingId: string,
    @Body() createPaymentDto: CreatePaymentDto
  ) {
    return this.invoicesService.addPayment(orgId, bookingId, createPaymentDto);
  }
}
