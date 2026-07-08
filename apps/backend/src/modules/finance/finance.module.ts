import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';

@Module({
  controllers: [FinanceController, CreditController],
  providers: [FinanceService, CreditService],
  exports: [FinanceService, CreditService],
})
export class FinanceModule {}
