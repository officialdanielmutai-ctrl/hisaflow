import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { DataExportService } from './data-export.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('exports')
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get(':dataset')
  async export(
    @Param('dataset') dataset: string,
    @OrgContext() orgId: string,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.dataExportService.build(dataset, orgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }
}
