import { IsString, IsOptional, IsNumber, IsPositive, IsDateString, IsIn } from 'class-validator';

export class UpdateCreditDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amountTotal?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  status?: 'UNPAID' | 'PARTIAL' | 'PAID';
}
