import { IsString, IsOptional, IsEnum, IsIn } from 'class-validator';

export enum BusinessType {
  DUKA = 'DUKA',
  MINI_MART = 'MINI_MART',
  CHEMIST = 'CHEMIST',
  RESTAURANT = 'RESTAURANT',
  SCHOOL = 'SCHOOL',
  WHOLESALER = 'WHOLESALER',
  ISP = 'ISP',
  GUEST_HOUSE = 'GUEST_HOUSE',
}

export const PREFERRED_PLAN_VALUES = ['SOLO', 'TEAM', 'GROWTH'] as const;
export type PreferredPlan = (typeof PREFERRED_PLAN_VALUES)[number];

export class CreateOrganizationDto {
  @IsString()
  name!: string;

  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  country?: string;

  /**
   * Advisory plan intent from the landing page. Invalid or missing values are
   * ignored by validation; a valid value is only stored as a preference.
   */
  @IsOptional()
  @IsIn(PREFERRED_PLAN_VALUES)
  preferredPlan?: PreferredPlan;
}
