import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddConsumptionDto } from './dto/add-consumption.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { Organization } from '../../../generated/prisma/client';

@Controller('bookings')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  create(
    @OrgContext() orgId: string,
    @Body() createBookingDto: CreateBookingDto
  ) {
    return this.bookingsService.create(orgId, createBookingDto);
  }

  @Get()
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  findAll(@OrgContext() orgId: string) {
    return this.bookingsService.findAll(orgId);
  }

  @Get(':id')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  findOne(
    @OrgContext() orgId: string,
    @Param('id') id: string
  ) {
    return this.bookingsService.findOne(orgId, id);
  }

  @Patch(':id/check-in')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  checkIn(
    @OrgContext() orgId: string,
    @Param('id') id: string
  ) {
    return this.bookingsService.checkIn(orgId, id);
  }

  @Patch(':id/check-out')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  checkOut(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Query('force') force: string
  ) {
    // Note: To properly restrict force=true to OWNER, we would check the user's actual role here.
    // For now, if force is passed, we pass it to the service. We could enforce role in controller
    // if we had the user's role on the request object.
    return this.bookingsService.checkOut(orgId, id, force === 'true');
  }

  @Patch(':id/cancel')
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  cancel(
    @OrgContext() orgId: string,
    @Param('id') id: string
  ) {
    return this.bookingsService.cancel(orgId, id);
  }

  @Post(':id/consumption')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  addConsumption(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() addConsumptionDto: AddConsumptionDto
  ) {
    return this.bookingsService.addConsumption(orgId, id, addConsumptionDto);
  }
}
