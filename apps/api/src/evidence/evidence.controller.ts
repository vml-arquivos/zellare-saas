import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EvidenceReviewStatus, RoleLevel } from '@prisma/client';
import { EvidenceService } from './evidence.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('evidence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @RequireRoles(
    RoleLevel.PROFESSOR,
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
    RoleLevel.FAMILIA,
  )
  list(@Query() query: any, @CurrentUser() user: JwtPayload) {
    return this.evidenceService.list(query, user);
  }

  @Get('child/:childId/summary')
  @RequireRoles(
    RoleLevel.PROFESSOR,
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
    RoleLevel.FAMILIA,
  )
  summary(@Param('childId') childId: string, @CurrentUser() user: JwtPayload) {
    return this.evidenceService.summary(childId, user);
  }

  @Get('child/:childId/cross-analysis')
  @RequireRoles(
    RoleLevel.PROFESSOR,
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
    RoleLevel.FAMILIA,
  )
  crossAnalysis(
    @Param('childId') childId: string,
    @Query() query: { startDate?: string; endDate?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.evidenceService.crossAnalysis(childId, query, user);
  }

  @Patch(':id/review')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  review(
    @Param('id') id: string,
    @Body() body: { status: EvidenceReviewStatus; note?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.evidenceService.review(id, body.status, body.note, user);
  }

  @Post('backfill')
  @RequireRoles(RoleLevel.DEVELOPER)
  backfill() {
    return this.evidenceService.backfill();
  }
}
