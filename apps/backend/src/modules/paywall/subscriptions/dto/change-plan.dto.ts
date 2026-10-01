import { IsEnum } from 'class-validator';
import { HisaflowPlanTier } from '@prisma/client';

export class ChangePlanDto {
  @IsEnum(HisaflowPlanTier)
  tier!: HisaflowPlanTier;
}
