import { Module } from '@nestjs/common';
import { AiIngestionController } from './ai-ingestion.controller';
import { AiIngestionService } from './ai-ingestion.service';
import { PrismaService } from '../../infrastructure/prisma.service';

@Module({
  controllers: [AiIngestionController],
  providers: [AiIngestionService, PrismaService],
})
export class AiIngestionModule {}
