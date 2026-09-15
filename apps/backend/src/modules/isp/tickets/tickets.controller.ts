import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
@UseGuards(ClerkAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@OrgContext() orgId: string, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(orgId, dto);
  }

  @Get()
  findAll(
    @OrgContext() orgId: string,
    @Query('status') status?: TicketStatus,
    @Query('subscriberId') subscriberId?: string,
  ) {
    return this.ticketsService.findAll(orgId, status, subscriberId);
  }

  @Get(':id')
  findOne(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.ticketsService.findOne(orgId, id);
  }

  @Patch(':id')
  update(@OrgContext() orgId: string, @Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(orgId, id, dto);
  }

  @Patch(':id/start')
  start(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.ticketsService.transition(orgId, id, TicketStatus.IN_PROGRESS);
  }

  @Patch(':id/resolve')
  resolve(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.ticketsService.transition(orgId, id, TicketStatus.RESOLVED);
  }

  @Patch(':id/close')
  close(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.ticketsService.transition(orgId, id, TicketStatus.CLOSED);
  }

  @Patch(':id/reopen')
  reopen(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.ticketsService.transition(orgId, id, TicketStatus.OPEN);
  }
}
