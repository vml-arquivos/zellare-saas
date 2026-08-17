import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditDashboardAccessInterceptor } from '../common/interceptors/audit-dashboard-access.interceptor';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditDashboardAccessInterceptor)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('coverage')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  getCoverage(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.metrics.getCoverage(user, days ? Number(days) : undefined);
  }
}
