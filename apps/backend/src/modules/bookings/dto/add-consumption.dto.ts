import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class AddConsumptionDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;
}
