import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiIngestionService } from './ai-ingestion.service';
import { IngestTextDto } from './dto/ingest-text.dto';
import { CaptureUtteranceDto } from './dto/capture-utterance.dto';
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
      dto.source ?? 'TEXT',
    );

    return { actions: result };
  }

  /**
   * Consent-gated, anonymised capture of a user utterance for building the
   * assistant golden set. Stores no organization/user identity.
   */
  @Post('capture')
  async capture(
    @Body() dto: CaptureUtteranceDto,
    @OrgContext() orgId: string,
  ) {
    return this.aiIngestionService.captureUtterance(
      dto.text,
      orgId,
      dto.source ?? 'TEXT',
      dto.consent,
    );
  }
}
