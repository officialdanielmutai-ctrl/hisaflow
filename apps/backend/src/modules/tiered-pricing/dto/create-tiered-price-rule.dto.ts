import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTieredPriceRuleDto {
  @IsString() @IsNotEmpty()
  inventoryItemId!: string;

  @IsNumber() @Min(0.001) @Type(() => Number)
  minQuantity!: number;

  @IsNumber() @Min(0) @Type(() => Number)
  pricePerUnit!: number;

  @IsOptional() @IsString()
  label?: string;
}
