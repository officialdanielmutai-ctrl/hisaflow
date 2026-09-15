import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';
import { SubscriberStatus } from '@prisma/client';
import { IsString } from 'class-validator';

class LinkRouterDto {
  @IsString() routerId!: string;
  @IsString() routerAccountRef!: string;
}

@Controller('subscribers')
@UseGuards(ClerkAuthGuard)
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  create(
    @OrgContext() orgId: string,
    @Body() createSubscriberDto: CreateSubscriberDto,
  ) {
    return this.subscribersService.create(orgId, createSubscriberDto);
  }

  @Get()
  findAll(
    @OrgContext() orgId: string,
    @Query('status') status?: SubscriberStatus,
    @Query('planId') planId?: string,
  ) {
    return this.subscribersService.findAll(orgId, status, planId);
  }

  @Get(':id')
  findOne(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.findOne(orgId, id);
  }

  @Patch(':id')
  update(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() updateSubscriberDto: UpdateSubscriberDto,
  ) {
    return this.subscribersService.update(orgId, id, updateSubscriberDto);
  }

  @Patch(':id/suspend')
  suspend(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.updateStatus(orgId, id, SubscriberStatus.SUSPENDED);
  }

  @Patch(':id/reactivate')
  reactivate(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.updateStatus(orgId, id, SubscriberStatus.ACTIVE);
  }

  @Patch(':id/churn')
  churn(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.updateStatus(orgId, id, SubscriberStatus.CHURNED);
  }

  // ── Phase 6b: Router actions ───────────────────────────────────────────────

  /** Link (or update) this subscriber's router and PPP/hotspot account reference */
  @Patch(':id/router-link')
  linkRouter(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() dto: LinkRouterDto,
  ) {
    return this.subscribersService.linkRouter(orgId, id, dto.routerId, dto.routerAccountRef);
  }

  /** Suspend subscriber on the router immediately (manual) */
  @Post(':id/router-suspend')
  routerSuspend(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.routerSuspend(orgId, id);
  }

  /** Reconnect subscriber on the router immediately (manual) */
  @Post(':id/router-reconnect')
  routerReconnect(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.routerReconnect(orgId, id);
  }

  /** Get recent router action history for a subscriber */
  @Get(':id/router-actions')
  getRouterActions(
    @OrgContext() orgId: string,
    @Param('id') id: string,
  ) {
    return this.subscribersService.getRouterActions(orgId, id);
  }
}
