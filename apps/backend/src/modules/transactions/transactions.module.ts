import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AlertsModule } from '../alerts/alerts.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AlertsModule, FinanceModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
