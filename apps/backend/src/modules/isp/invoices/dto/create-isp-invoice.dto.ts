import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateIspInvoiceDto {
  @IsString()
  @IsNotEmpty()
  subscriberId!: string;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;
}
