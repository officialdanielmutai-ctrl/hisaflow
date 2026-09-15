import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RoutersService } from './routers.service';
import { CreateRouterDto } from './dto/create-router.dto';
import { UpdateRouterDto } from './dto/update-router.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';

@Controller('routers')
@UseGuards(ClerkAuthGuard)
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  @Get()
  findAll(@OrgContext() orgId: string) {
    return this.routersService.findAll(orgId);
  }

  @Post()
  create(@OrgContext() orgId: string, @Body() dto: CreateRouterDto) {
    return this.routersService.create(orgId, dto);
  }

  @Patch(':id')
  update(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRouterDto,
  ) {
    return this.routersService.update(orgId, id, dto);
  }

  @Delete(':id')
  remove(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.routersService.remove(orgId, id);
  }

  /**
   * POST /routers/:id/test
   * Attempts a live API-SSL call and returns { success, latencyMs, routerIdentity?, error? }
   */
  @Post(':id/test')
  testConnection(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.routersService.testConnection(orgId, id);
  }
}
