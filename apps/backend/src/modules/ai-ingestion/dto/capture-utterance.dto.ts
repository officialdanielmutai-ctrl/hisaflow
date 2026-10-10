import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CaptureUtteranceDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  @IsIn(['TEXT', 'RECEIPT_OCR', 'LABEL_OCR'])
  source?: 'TEXT' | 'RECEIPT_OCR' | 'LABEL_OCR';

  @IsBoolean()
  consent!: boolean;
}
