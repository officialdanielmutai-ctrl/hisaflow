import { IsNotEmpty, IsString, IsOptional, MinLength } from 'class-validator';

export class AccessMessageDto {
  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsString()
  orgId!: string;

  @IsNotEmpty({ message: 'A specific reason must be chosen from the access taxonomy' })
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
