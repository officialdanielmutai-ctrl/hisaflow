import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  IsDateString,
  MinLength,
} from 'class-validator';
import { BulkSendChannel } from '@prisma/client';

export class SegmentCriteriaDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessTypes?: string[];

  @IsOptional()
  @IsString()
  orgSearch?: string;

  @IsOptional()
  activityDays?: number;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @IsEnum(BulkSendChannel)
  channel!: BulkSendChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsObject()
  segmentCriteria?: SegmentCriteriaDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsEnum(BulkSendChannel)
  channel?: BulkSendChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsObject()
  segmentCriteria?: SegmentCriteriaDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
