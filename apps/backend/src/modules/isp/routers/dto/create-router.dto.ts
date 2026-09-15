import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateRouterDto {
  @IsString()
  label!: string;

  @IsString()
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsString()
  apiUsername!: string;

  @IsString()
  apiPassword!: string;
}
