import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FeeStructureItemDto {
  @IsOptional() @IsString() classId?: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() @Min(0) @Type(() => Number) amount!: number;
  @IsOptional() @IsBoolean() isOptional?: boolean;
}

export class CreateAcademicTermDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() startDate!: string;
  @IsString() @IsNotEmpty() endDate!: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FeeStructureItemDto)
  feeStructures?: FeeStructureItemDto[];
}
