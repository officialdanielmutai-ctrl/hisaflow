import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsNumber()
  @IsNotEmpty()
  baseRate!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
