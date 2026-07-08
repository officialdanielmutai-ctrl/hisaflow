import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

export class RecordPaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
