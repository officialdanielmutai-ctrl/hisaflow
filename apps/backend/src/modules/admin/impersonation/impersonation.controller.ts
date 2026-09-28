import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { ImpersonationService } from './impersonation.service';
import { GenerateImpersonationTokenDto } from './dto/generate-token.dto';

@Controller('admin/impersonation')
@UseGuards(AdminAuthGuard, AdminRoleGuard)
export class ImpersonationController {
  constructor(private readonly impersonationService: ImpersonationService) {}

  /**
   * POST /admin/impersonation/generate
   * Generate a short-lived (15-min) read-only view-as token.
   * Restricted to SUPER_ADMIN and SUPPORT_ADMIN.
   */
  @Post('generate')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() dto: GenerateImpersonationTokenDto, @Req() req: any) {
    const adminUser = req.adminUser;
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const { tokenRecord, signedJwt } = await this.impersonationService.generateToken(
      dto.targetOrgId,
      dto.reason,
      adminUser,
      ipAddress,
    );

    return {
      id: tokenRecord.id,
      token: signedJwt,
      targetOrgId: tokenRecord.targetOrgId,
      targetOrgName: tokenRecord.targetOrgName,
      reason: tokenRecord.reason,
      expiresAt: tokenRecord.expiresAt,
      createdAt: tokenRecord.createdAt,
    };
  }

  /**
   * POST /admin/impersonation/:id/revoke
   * Revoke an active impersonation token before its natural expiry.
   * Restricted to SUPER_ADMIN only.
   */
  @Post(':id/revoke')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('id') id: string, @Req() req: any) {
    const adminUser = req.adminUser;
    const revoked = await this.impersonationService.revokeToken(id, adminUser);
    return {
      id: revoked.id,
      revokedAt: revoked.revokedAt,
      targetOrgId: revoked.targetOrgId,
      targetOrgName: revoked.targetOrgName,
    };
  }

  /**
   * GET /admin/impersonation/history
   * Paginated history of all impersonation tokens.
   * Restricted to SUPER_ADMIN only.
   */
  @Get('history')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  async history(
    @Query('adminId') adminId?: string,
    @Query('targetOrgId') targetOrgId?: string,
    @Query('page') page?: string,
  ) {
    return this.impersonationService.listHistory({
      adminId,
      targetOrgId,
      page: page ? parseInt(page, 10) : 1,
    });
  }

  /**
   * GET /admin/impersonation/active
   * List currently active (non-revoked, non-expired) sessions.
   * Restricted to SUPER_ADMIN only.
   */
  @Get('active')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  async activeSessions() {
    return this.impersonationService.listActive();
  }

  /**
   * POST /admin/impersonation/validate
   * Validate a token (used by the customer-facing app to verify a view-as session).
   * Available to SUPER_ADMIN and SUPPORT_ADMIN.
   */
  @Post('validate')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async validate(@Body('token') token: string) {
    const payload = await this.impersonationService.validateToken(token);
    return {
      valid: true,
      adminId: payload.adminId,
      adminName: payload.adminName,
      targetOrgId: payload.targetOrgId,
      targetOrgName: payload.targetOrgName,
      reason: payload.reason,
      readOnly: payload.readOnly,
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
