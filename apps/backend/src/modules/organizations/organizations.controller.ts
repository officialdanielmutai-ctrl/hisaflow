import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

// TODO: add ClerkAuthGuard when auth module is ready
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? 'dev-user';
    return this.organizationsService.create(dto, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }
}
