import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsDateString, Min } from 'class-validator';

export class CreateBusinessTransactionDto {
  @IsIn(['INCOME', 'EXPENSE'])
  type!: 'INCOME' | 'EXPENSE';

  @IsString()
  category!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  staffName?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsIn(['MONTHLY', 'WEEKLY', 'YEARLY'])
  recurrenceRule?: string;
}
