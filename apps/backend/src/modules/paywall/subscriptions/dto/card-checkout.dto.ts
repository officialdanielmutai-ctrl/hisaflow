import { IsEmail, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { HisaflowPlanTier } from '@prisma/client';

export class CardCheckoutDto {
  @IsEnum(HisaflowPlanTier)
  tier!: HisaflowPlanTier;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;
}
