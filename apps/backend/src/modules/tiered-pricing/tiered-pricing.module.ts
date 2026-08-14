import { Module } from '@nestjs/common';
import { TieredPricingController } from './tiered-pricing.controller';
import { TieredPricingService } from './tiered-pricing.service';

@Module({
  controllers: [TieredPricingController],
  providers: [TieredPricingService],
  exports: [TieredPricingService],
})
export class TieredPricingModule {}
