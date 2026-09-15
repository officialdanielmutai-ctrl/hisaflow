import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class IssueEquipmentDto {
  @IsString()
  @IsNotEmpty()
  subscriberId!: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsString()
  @IsOptional()
  workOrderId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  chargeToInvoice?: boolean;
}
