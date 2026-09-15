import { IsString, IsOptional } from 'class-validator';

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  subscriberId?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
