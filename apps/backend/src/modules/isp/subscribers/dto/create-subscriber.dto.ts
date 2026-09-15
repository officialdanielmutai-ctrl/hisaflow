import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ConnectionType } from '@prisma/client';

export class CreateSubscriberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(ConnectionType)
  @IsOptional()
  connectionType?: ConnectionType;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
