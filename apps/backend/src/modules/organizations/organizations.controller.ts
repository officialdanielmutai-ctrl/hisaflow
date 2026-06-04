import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: { id: string; clerkId: string },
  ) {
    const userId = user.id;
    return this.organizationsService.create(dto, userId);
  }

  @Get('me')
  async getMyOrganizations(
    @CurrentUser() user: { id: string; clerkId: string },
  ) {
    return this.organizationsService.getOrganizationsForUser(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }
}
