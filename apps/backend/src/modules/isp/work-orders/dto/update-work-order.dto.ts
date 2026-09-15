import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { WorkOrderType, WorkOrderStatus } from '@prisma/client';

export class UpdateWorkOrderDto {
  @IsString()
  @IsOptional()
  subscriberId?: string;

  @IsEnum(WorkOrderType)
  @IsOptional()
  type?: WorkOrderType;

  @IsEnum(WorkOrderStatus)
  @IsOptional()
  status?: WorkOrderStatus;

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
