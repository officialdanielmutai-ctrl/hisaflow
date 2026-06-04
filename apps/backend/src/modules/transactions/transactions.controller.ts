import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard)
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
}
