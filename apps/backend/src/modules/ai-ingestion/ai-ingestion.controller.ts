import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiIngestionService } from './ai-ingestion.service';
import { IngestTextDto } from './dto/ingest-text.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { PrismaService } from '../../infrastructure/prisma.service';

@UseGuards(ClerkAuthGuard)
@Controller('ai-ingestion')
export class AiIngestionController {
  constructor(
    private readonly aiIngestionService: AiIngestionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('parse')
  async parse(
    @Body() dto: IngestTextDto,
    @OrgContext() orgId: string,
  ) {
    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
    });

    const result = await this.aiIngestionService.parseInventoryText(
      dto.text,
      items,
    );

    return { actions: result };
  }
}
