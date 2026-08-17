import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RankingQueryDto } from './dto/ranking.dto';
import { TeacherRankingService } from './teacher-ranking.service';

@Controller('teacher-ranking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherRankingController {
  constructor(private readonly service: TeacherRankingService) {}

  @Get()
  @RequireRoles(
    RoleLevel.PROFESSOR,
    RoleLevel.UNIDADE,
    RoleLevel.STAFF_CENTRAL,
    RoleLevel.MANTENEDORA,
    RoleLevel.DEVELOPER,
  )
  ranking(@Query() query: RankingQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.ranking(query, user);
  }
}
