import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum TransactionTypeDto {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  ADJUSTMENT = 'ADJUSTMENT',
  WASTAGE = 'WASTAGE',
}

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsEnum(TransactionTypeDto)
  type!: TransactionTypeDto;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;

  // Business specific fields
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  metadata?: any;
}
