import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class RecordIspPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  method!: string; // CASH | MPESA | CARD

  @IsString()
  @IsOptional()
  note?: string;
}
