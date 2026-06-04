import { Module } from '@nestjs/common';
import { AiIngestionController } from './ai-ingestion.controller';
import { AiIngestionService } from './ai-ingestion.service';

@Module({
  controllers: [AiIngestionController],
  providers: [AiIngestionService],
})
export class AiIngestionModule {}
