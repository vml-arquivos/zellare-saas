import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RoleLevel } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireRoles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  JourneyCapabilityGuard,
  RequireJourneyCapability,
} from "./journey-capability.guard";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { JourneyService } from "./journey.service";
import {
  ChangeJourneyStageDto,
  CreateJourneyActivityDto,
  CreateJourneyOfferDto,
  CreateJourneyPolicyDto,
  CreateJourneyProspectDto,
  CreateJourneyTaskDto,
  CreateJourneyVisitDto,
  DecideJourneyOfferDto,
  JourneyDashboardQueryDto,
  JourneyDuplicateReviewDto,
  JourneyListQueryDto,
  JourneyPrivacyActionDto,
  JourneyRetentionDto,
  JourneyVisitActionDto,
  JoinJourneyWaitlistDto,
  PublishJourneyPolicyDto,
  RescheduleJourneyVisitDto,
} from "./dto/journey.dto";

const JOURNEY_ROLES = [
  RoleLevel.UNIDADE,
  RoleLevel.STAFF_CENTRAL,
  RoleLevel.MANTENEDORA,
  RoleLevel.DEVELOPER,
] as const;

@Controller("journey")
@UseGuards(JwtAuthGuard, RolesGuard, JourneyCapabilityGuard)
export class JourneyController {
  constructor(private readonly journey: JourneyService) {}

  @Get("units")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.read")
  listUnits(@CurrentUser() user: JwtPayload) {
    return this.journey.listUnits(user);
  }

  @Get("dashboard")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.read")
  dashboard(
    @Query() query: JourneyDashboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.dashboard(query, user);
  }

  @Get("prospects")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.read")
  listProspects(
    @Query() query: JourneyListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.listProspects(query, user);
  }

  @Post("prospects")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.manage")
  createProspect(
    @Body() dto: CreateJourneyProspectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.createProspect(dto, user);
  }

  @Get("prospects/:id")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.read")
  getProspect(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.journey.getProspect(id, user);
  }

  @Patch("prospects/:id/privacy/retention")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.privacy.manage")
  setProspectRetention(
    @Param("id") id: string,
    @Body() dto: JourneyRetentionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.setProspectRetention(id, dto, user);
  }

  @Patch("prospects/:id/privacy/contact/revoke")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.privacy.manage")
  revokeProspectContact(
    @Param("id") id: string,
    @Body() dto: JourneyPrivacyActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.revokeProspectContact(id, dto, user);
  }

  @Patch("prospects/:id/privacy/erase")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.privacy.manage")
  eraseProspect(
    @Param("id") id: string,
    @Body() dto: JourneyPrivacyActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.eraseProspect(id, dto, user);
  }

  @Patch("prospects/:id/stage")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.manage")
  changeStage(
    @Param("id") id: string,
    @Body() dto: ChangeJourneyStageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.changeStage(id, dto, user);
  }

  @Post("prospects/:id/activities")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.manage")
  createActivity(
    @Param("id") id: string,
    @Body() dto: CreateJourneyActivityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.createActivity(id, dto, user);
  }

  @Post("prospects/:id/tasks")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.manage")
  createTask(
    @Param("id") id: string,
    @Body() dto: CreateJourneyTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.createTask(id, dto, user);
  }

  @Patch("tasks/:id/complete")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.prospect.manage")
  completeTask(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.journey.completeTask(id, user);
  }

  @Get("visits")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.read")
  listVisits(
    @Query() query: JourneyListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.listVisits(query, user);
  }

  @Post("visits")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.manage")
  createVisit(
    @Body() dto: CreateJourneyVisitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.createVisit(dto, user);
  }

  @Get("visits/:id")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.read")
  getVisit(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.journey.getVisit(id, user);
  }

  @Patch("visits/:id/reschedule")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.manage")
  rescheduleVisit(
    @Param("id") id: string,
    @Body() dto: RescheduleJourneyVisitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.rescheduleVisit(id, dto, user);
  }

  @Patch("visits/:id/cancel")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.manage")
  cancelVisit(
    @Param("id") id: string,
    @Body() dto: JourneyVisitActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.cancelVisit(id, dto, user);
  }

  @Patch("visits/:id/confirm")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.manage")
  confirmVisit(
    @Param("id") id: string,
    @Body() dto: JourneyVisitActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.confirmVisit(id, dto, user);
  }

  @Patch("visits/:id/absence")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.manage")
  markVisitAbsence(
    @Param("id") id: string,
    @Body() dto: JourneyVisitActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.markVisitAbsence(id, dto, user);
  }

  @Patch("visits/:id/follow-up")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.visit.manage")
  registerVisitFollowUp(
    @Param("id") id: string,
    @Body() dto: JourneyVisitActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.registerVisitFollowUp(id, dto, user);
  }

  @Get("waitlist/policies")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.read")
  listPolicies(
    @Query() query: JourneyListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.listPolicies(query, user);
  }

  @Post("waitlist/policies")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.waitlist.manage")
  createPolicy(
    @Body() dto: CreateJourneyPolicyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.createPolicy(dto, user);
  }

  @Patch("waitlist/policies/:id/review")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.waitlist.manage")
  reviewPolicy(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.journey.reviewPolicy(id, user);
  }

  @Patch("waitlist/policies/:id/publish")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.waitlist.manage")
  publishPolicy(
    @Param("id") id: string,
    @Body() dto: PublishJourneyPolicyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.publishPolicy(id, dto, user);
  }

  @Get("waitlist")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.waitlist.read")
  listWaitlist(
    @Query() query: JourneyListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.listWaitlist(query, user);
  }

  @Post("waitlist")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.waitlist.manage")
  joinWaitlist(
    @Body() dto: JoinJourneyWaitlistDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.joinWaitlist(dto, user);
  }

  @Get("offers")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.offer.read")
  listOffers(
    @Query() query: JourneyListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.listOffers(query, user);
  }

  @Post("offers")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.offer.create")
  createOffer(
    @Body() dto: CreateJourneyOfferDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.createOffer(dto, user);
  }

  @Patch("offers/:id/decision")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.offer.accept")
  decideOffer(
    @Param("id") id: string,
    @Body() dto: DecideJourneyOfferDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.decideOffer(id, dto, user);
  }

  @Get("duplicates")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.read")
  listDuplicateReviews(@CurrentUser() user: JwtPayload) {
    return this.journey.listDuplicateReviews(user);
  }

  @Patch("duplicates/:id/review")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.merge.review")
  reviewDuplicate(
    @Param("id") id: string,
    @Body() dto: JourneyDuplicateReviewDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.reviewDuplicate(id, dto, user);
  }

  @Post("duplicates/:id/undo")
  @RequireRoles(...JOURNEY_ROLES)
  @RequireJourneyCapability("journey.merge.review")
  undoDuplicate(
    @Param("id") id: string,
    @Body() dto: PublishJourneyPolicyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journey.undoDuplicate(id, dto.idempotencyKey, user);
  }
}
