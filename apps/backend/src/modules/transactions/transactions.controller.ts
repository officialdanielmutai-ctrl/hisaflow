import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @OrgContext() orgId: string,
  ) {
    return this.transactionsService.create(dto, orgId);
  }

  @Get()
  async getTransactions(
    @OrgContext() orgId: string,
    @Query('itemId') itemId?: string,
    @Query('type') type?: string,
  ) {
    return this.transactionsService.findAll(orgId, { itemId, type });
  }
}
