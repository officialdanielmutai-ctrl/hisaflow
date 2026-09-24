import { IsOptional, IsString } from 'class-validator';

export class QueryAccountsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;
}
