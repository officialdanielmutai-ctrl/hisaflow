import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ProposeToolDto {
  @IsString()
  @IsNotEmpty()
  tool!: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
