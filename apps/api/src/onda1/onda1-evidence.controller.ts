import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda1EvidenceService } from './onda1-evidence.service';
import {
  CreateEvidenceLinkDto,
  CreateGoalDto,
  CreateReviewTaskDto,
  CreateSupportActionDto,
  EvidenceLoopQueryDto,
  ReviewQueueQueryDto,
  UpdateGoalDto,
  UpdateReviewTaskDto,
  UpdateSupportOutcomeDto,
} from './dto/onda1.dto';

const READ_ROLES = [
  RoleLevel.PROFESSOR,
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
  RoleLevel.FAMILIA,
];
const OPERATIONS_ROLES = [RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER];

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class Onda1EvidenceController {
  constructor(private readonly service: Onda1EvidenceService) {}

  @Get('children/:childId/evidence-loop')
  @RequireRoles(...READ_ROLES)
  child360(@Param('childId') childId: string, @Query() query: EvidenceLoopQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.child360(childId, query, user);
  }

  @Get('evidence/review-queue')
  @RequireRoles(...OPERATIONS_ROLES)
  reviewQueue(@Query() query: ReviewQueueQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.reviewQueue(query, user);
  }

  @Post('evidence/:id/review-tasks')
  @RequireRoles(...OPERATIONS_ROLES)
  createReviewTask(@Param('id') evidenceId: string, @Body() dto: CreateReviewTaskDto, @CurrentUser() user: JwtPayload) {
    return this.service.createReviewTask(evidenceId, dto, user);
  }

  @Patch('evidence/review-tasks/:taskId')
  @RequireRoles(...OPERATIONS_ROLES)
  updateReviewTask(@Param('taskId') taskId: string, @Body() dto: UpdateReviewTaskDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateReviewTask(taskId, dto, user);
  }

  @Get('children/:childId/goals')
  @RequireRoles(...READ_ROLES)
  listGoals(@Param('childId') childId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listGoals(childId, user);
  }

  @Post('children/:childId/goals')
  @RequireRoles(...OPERATIONS_ROLES, RoleLevel.PROFESSOR)
  createGoal(@Param('childId') childId: string, @Body() dto: CreateGoalDto, @CurrentUser() user: JwtPayload) {
    return this.service.createGoal(childId, dto, user);
  }

  @Patch('children/:childId/goals/:goalId')
  @RequireRoles(...OPERATIONS_ROLES, RoleLevel.PROFESSOR)
  updateGoal(@Param('childId') childId: string, @Param('goalId') goalId: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateGoal(childId, goalId, dto, user);
  }

  @Post('children/:childId/goals/:goalId/support-actions')
  @RequireRoles(...OPERATIONS_ROLES, RoleLevel.PROFESSOR)
  createSupport(@Param('childId') childId: string, @Param('goalId') goalId: string, @Body() dto: CreateSupportActionDto, @CurrentUser() user: JwtPayload) {
    return this.service.createSupport(childId, goalId, dto, user);
  }

  @Patch('support-actions/:id/outcome')
  @RequireRoles(...OPERATIONS_ROLES, RoleLevel.PROFESSOR)
  updateSupportOutcome(@Param('id') id: string, @Body() dto: UpdateSupportOutcomeDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateSupportOutcome(id, dto, user);
  }

  @Post('evidence/:id/links')
  @RequireRoles(...OPERATIONS_ROLES, RoleLevel.PROFESSOR)
  linkEvidence(@Param('id') evidenceId: string, @Body() dto: CreateEvidenceLinkDto, @CurrentUser() user: JwtPayload) {
    return this.service.linkEvidence(evidenceId, dto, user);
  }
}
