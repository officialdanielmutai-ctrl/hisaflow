import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { BusinessTransactionsService } from './business-transactions.service';
import { FinanceAiService } from './finance-ai.service';
import { FinanceBreakdownService } from './finance-breakdown.service';
import { FinanceSearchService } from './finance-search.service';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

@Module({
  controllers: [FinanceController, CreditController],
  providers: [
    FinanceService,
    FinanceBreakdownService,
    FinanceSearchService,
    BusinessTransactionsService,
    FinanceAiService,
    CreditService,
  ],
  exports: [
    FinanceService,
    FinanceBreakdownService,
    FinanceSearchService,
    BusinessTransactionsService,
    FinanceAiService,
    CreditService,
  ],
})
export class FinanceModule {}
