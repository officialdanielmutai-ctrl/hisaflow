import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum BusinessType {
  DUKA = 'DUKA',
  MINI_MART = 'MINI_MART',
  CHEMIST = 'CHEMIST',
  RESTAURANT = 'RESTAURANT',
  SCHOOL = 'SCHOOL',
  WHOLESALER = 'WHOLESALER',
  ISP = 'ISP',
}

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
}
