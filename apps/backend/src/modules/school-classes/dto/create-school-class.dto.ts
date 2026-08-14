import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
export class CreateSchoolClassDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() stream?: string;
  @IsOptional() @IsString() notes?: string;
}
