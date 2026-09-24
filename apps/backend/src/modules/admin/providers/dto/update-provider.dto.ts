import { IsNotEmpty, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  apiKey?: string; // Key rotation

  @IsOptional()
  @IsNumber()
  @Min(1)
  rpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;
}
