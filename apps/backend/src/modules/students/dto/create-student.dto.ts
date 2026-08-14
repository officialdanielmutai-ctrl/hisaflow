import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateStudentDto {
  @IsOptional() @IsString() classId?: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() admissionNumber?: string;
  @IsOptional() @IsString() dateOfBirth?: string;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsString() guardianEmail?: string;
  @IsOptional() @IsString() guardianRelation?: string;
  @IsOptional() @IsString() notes?: string;
}
