import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../../../../generated/prisma/client';

export class AdjustStockDto {
  @IsString()
  itemId!: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Type(() => Number)
  quantityChange!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
