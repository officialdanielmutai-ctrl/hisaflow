import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { AiIngestionModule } from '../ai-ingestion/ai-ingestion.module';

@Module({
  imports: [AiIngestionModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
