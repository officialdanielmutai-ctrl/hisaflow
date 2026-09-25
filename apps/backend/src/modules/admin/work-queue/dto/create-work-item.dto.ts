import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { WorkItemPriority, WorkItemStatus } from '@prisma/client';

export class CreateWorkItemDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsEnum(WorkItemPriority)
  priority?: WorkItemPriority;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  assignedToAdminId?: string;

  @IsOptional()
  @IsString()
  assignedToAdminName?: string;
}

export class UpdateWorkItemDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkItemPriority)
  priority?: WorkItemPriority;

  @IsOptional()
  @IsEnum(WorkItemStatus)
  status?: WorkItemStatus;

  @IsOptional()
  @IsString()
  assignedToAdminId?: string;

  @IsOptional()
  @IsString()
  assignedToAdminName?: string;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
