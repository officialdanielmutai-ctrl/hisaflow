import { IsNumber, IsPositive, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateCreditDto {
  @IsString()
  @IsNotEmpty()
  clientName!: string;

  @IsNumber()
  @IsPositive()
  amountTotal!: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
