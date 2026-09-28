import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class GenerateImpersonationTokenDto {
  @IsString()
  @IsNotEmpty()
  targetOrgId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  reason!: string;
}
