import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStockBatchDto {
  @IsString() @IsNotEmpty() inventoryItemId!: string;
  @IsString() @IsNotEmpty() batchNumber!: string;
  @IsString() @IsNotEmpty() expiryDate!: string; // ISO date string
  @IsNumber() @Min(0.001) @Type(() => Number) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) costPrice?: number;
}
