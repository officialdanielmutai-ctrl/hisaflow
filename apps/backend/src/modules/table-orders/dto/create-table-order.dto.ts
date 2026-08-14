import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() @IsNotEmpty() itemId!: string;
  @IsNumber() @Min(0.001) @Type(() => Number) quantity!: number;
  @IsNumber() @Min(0) @Type(() => Number) unitPrice!: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateTableOrderDto {
  @IsString() @IsNotEmpty() tableLabel!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}

export class AddOrderItemDto {
  @IsString() @IsNotEmpty() itemId!: string;
  @IsNumber() @Min(0.001) @Type(() => Number) quantity!: number;
  @IsNumber() @Min(0) @Type(() => Number) unitPrice!: number;
  @IsOptional() @IsString() notes?: string;
}
