import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { TaxRegistrationService } from './tax-registration.service';
import { SaveTaxRegistrationDto } from './dto/save-tax-registration.dto';
import { SubmitTaxRegistrationDto } from './dto/submit-tax-registration.dto';
import { RecordKraOutcomeDto } from './dto/record-kra-outcome.dto';

/**
 * Phase A — org-facing KRA eTIMS registration tracking.
 *
 * Reads are open to any member (the Tax tab will surface status later); writes
 * are owner-only, because the KRA PIN and the registration belong to the
 * taxpayer. Status is only ever moved by explicit calls here — nothing advances
 * automatically, so the UI can never imply instant KRA activation.
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('tax/registration')
export class TaxRegistrationController {
  constructor(private readonly taxRegistration: TaxRegistrationService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get()
  get(@OrgContext() organizationId: string) {
    return this.taxRegistration.getView(organizationId);
  }

  @Roles(AppRole.OWNER)
  @Put()
  save(
    @OrgContext() organizationId: string,
    @Body() dto: SaveTaxRegistrationDto,
  ) {
    return this.taxRegistration.save(organizationId, dto);
  }

  @Roles(AppRole.OWNER)
  @Post('submit')
  submit(
    @OrgContext() organizationId: string,
    @Body() dto: SubmitTaxRegistrationDto,
  ) {
    return this.taxRegistration.submit(organizationId, dto);
  }

  @Roles(AppRole.OWNER)
  @Post('kra-outcome')
  recordOutcome(
    @OrgContext() organizationId: string,
    @Body() dto: RecordKraOutcomeDto,
  ) {
    return this.taxRegistration.recordOutcome(organizationId, dto);
  }
}
