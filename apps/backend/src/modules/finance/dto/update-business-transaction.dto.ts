import { IsOptional, IsString, IsNumber, IsPositive, IsBoolean, IsIn } from 'class-validator';

export class UpdateBusinessTransactionDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  staffName?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;
}
