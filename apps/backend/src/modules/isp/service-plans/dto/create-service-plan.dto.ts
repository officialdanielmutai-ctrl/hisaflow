import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { ConnectionType, BillingCycle } from '@prisma/client';

export class CreateServicePlanDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle;

  @IsEnum(ConnectionType)
  @IsOptional()
  connectionType?: ConnectionType;

  @IsNumber()
  @IsOptional()
  speedMbps?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
