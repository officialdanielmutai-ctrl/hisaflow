import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsEmail, MinLength } from 'class-validator';

export enum BulkChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export class BulkSendPreviewDto {
  @IsEnum(BulkChannel)
  channel!: BulkChannel;

  @IsOptional()
  @IsString()
  subject?: string; // required for EMAIL channel, validated in service

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  body!: string;

  // Filters — all optional, combined with AND
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessTypes?: string[];

  @IsOptional()
  @IsString()
  orgSearch?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  specificEmails?: string[]; // override: send only to this list

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificPhones?: string[]; // override: send only to this list
}

export class BulkSendDispatchDto extends BulkSendPreviewDto {
  // Same shape as preview — dispatch reads identical filters
}
