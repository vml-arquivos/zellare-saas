import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { CareService } from './care.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('care')
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class CareController {
  constructor(private readonly careService: CareService) {}

  /**
   * GET /care/children/:childId/overview
   * Visão integrada, somente leitura, de cuidado e desenvolvimento.
   * Dados sensíveis são minimizados conforme o papel do usuário.
   */
  @Get('children/:childId/overview')
  @RequireRoles(
    RoleLevel.PROFESSOR,
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  getChildOverview(
    @Param('childId') childId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.careService.getChildOverview(childId, user);
  }
}
