import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateInvoiceLineItemDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}
