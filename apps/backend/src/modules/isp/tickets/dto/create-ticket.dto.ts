import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subscriberId!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
