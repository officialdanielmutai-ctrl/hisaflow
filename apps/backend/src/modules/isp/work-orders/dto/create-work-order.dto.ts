import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { WorkOrderType } from '@prisma/client';

export class CreateWorkOrderDto {
  @IsString()
  @IsNotEmpty()
  subscriberId!: string;

  @IsEnum(WorkOrderType)
  type!: WorkOrderType;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  technicianName?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
