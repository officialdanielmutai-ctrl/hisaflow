import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiIngestionService } from './ai-ingestion.service';
import { IngestTextDto } from './dto/ingest-text.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('ai-ingestion')
export class AiIngestionController {
  constructor(
    private readonly aiIngestionService: AiIngestionService,
  ) {}

  @Post('parse')
  async parse(
    @Body() dto: IngestTextDto,
    @OrgContext() orgId: string,
  ) {
    const result = await this.aiIngestionService.parseInventoryText(
      dto.text,
      orgId,
    );

    return { actions: result };
  }
}
