import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @OrgContext() orgId: string,
    @CurrentUser() user: { id: string; name?: string; role?: string },
  ) {
    return this.transactionsService.create(dto, orgId, {
      actorId: user.id,
      actorName: user.name ?? 'Staff Member',
      actorRole: user.role ?? 'STAFF',
    });
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
