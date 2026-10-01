import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

/**
 * Global so any guard or service can ask "is this org entitled to X?" without
 * every module importing the billing module. This is deliberate: tier is a
 * second dimension on the existing vertical gate, not a per-module concern.
 */
@Global()
@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
