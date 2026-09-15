import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateRouterDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  apiUsername?: string;

  @IsOptional()
  @IsString()
  apiPassword?: string;
}
