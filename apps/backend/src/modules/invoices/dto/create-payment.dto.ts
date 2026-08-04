import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsString()
  @IsOptional()
  note?: string;
}
