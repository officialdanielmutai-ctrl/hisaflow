import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { BusinessTransactionsService } from './business-transactions.service';
import { FinanceAiService } from './finance-ai.service';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

@Module({
  controllers: [FinanceController, CreditController],
  providers: [
    FinanceService,
    BusinessTransactionsService,
    FinanceAiService,
    CreditService,
  ],
  exports: [
    FinanceService,
    BusinessTransactionsService,
    FinanceAiService,
    CreditService,
  ],
})
export class FinanceModule {}
