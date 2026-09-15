import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { IspInvoicesService } from './isp-invoices.service';
import { CreateIspInvoiceDto } from './dto/create-isp-invoice.dto';
import { AddIspLineItemDto } from './dto/add-isp-line-item.dto';
import { RecordIspPaymentDto } from './dto/record-isp-payment.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';

@Controller('isp-invoices')
@UseGuards(ClerkAuthGuard)
export class IspInvoicesController {
  constructor(private readonly invoicesService: IspInvoicesService) {}

  @Post('generate')
  generate(@OrgContext() orgId: string, @Body() dto: CreateIspInvoiceDto) {
    return this.invoicesService.generateForSubscriber(orgId, dto);
  }

  @Get('subscriber/:subscriberId')
  findBySubscriber(@OrgContext() orgId: string, @Param('subscriberId') subscriberId: string) {
    return this.invoicesService.findBySubscriber(orgId, subscriberId);
  }

  @Get(':id')
  findOne(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.invoicesService.findOne(orgId, id);
  }

  @Post(':id/line-items')
  addLineItem(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() dto: AddIspLineItemDto,
  ) {
    return this.invoicesService.addLineItem(orgId, id, dto);
  }

  @Post(':id/payments')
  recordPayment(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() dto: RecordIspPaymentDto,
  ) {
    return this.invoicesService.recordPayment(orgId, id, dto);
  }

  @Post(':id/issue')
  issue(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.invoicesService.issue(orgId, id);
  }

  @Post(':id/void')
  void(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.invoicesService.void(orgId, id);
  }
}
