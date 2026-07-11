import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { TenantConfigService } from './tenant-config.service';
import { UpsertTenantBrandingDto, SetFeatureFlagDto } from './dto/tenant-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('tenant-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantConfigController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  /** Ponto único que o frontend chama no boot: branding + flags de role + flags de tenant. */
  @Get()
  getFullConfig(@CurrentUser() user: JwtPayload) {
    return this.tenantConfigService.getFullConfig(user);
  }

  @Get('branding')
  getBranding(@CurrentUser() user: JwtPayload) {
    return this.tenantConfigService.getBranding(user.mantenedoraId);
  }

  @Put('branding')
  @RequireRoles('DEVELOPER', 'MANTENEDORA')
  upsertBranding(@Body() dto: UpsertTenantBrandingDto, @CurrentUser() user: JwtPayload) {
    return this.tenantConfigService.upsertBranding(dto, user);
  }

  @Get('flags')
  listFlags(@CurrentUser() user: JwtPayload) {
    return this.tenantConfigService.listTenantFlags(user);
  }

  @Post('flags')
  @RequireRoles('DEVELOPER')
  setFlag(@Body() dto: SetFeatureFlagDto, @CurrentUser() user: JwtPayload) {
    return this.tenantConfigService.setFlag(dto, user);
  }
}
