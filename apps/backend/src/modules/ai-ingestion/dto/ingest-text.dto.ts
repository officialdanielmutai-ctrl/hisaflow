import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class IngestTextDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  @IsIn(['TEXT', 'RECEIPT_OCR'])
  source?: 'TEXT' | 'RECEIPT_OCR';
}
