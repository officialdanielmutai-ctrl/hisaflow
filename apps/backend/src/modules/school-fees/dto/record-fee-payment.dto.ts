import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordFeePaymentDto {
  @IsNumber() @Min(0.01) @Type(() => Number) amount!: number;
  @IsString() @IsNotEmpty() method!: string; // CASH | MPESA | BANK
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}
