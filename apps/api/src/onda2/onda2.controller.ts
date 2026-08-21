import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2ComplianceService } from './onda2-compliance.service';
import { Onda2CoverageService } from './onda2-coverage.service';
import { Onda2FacilitiesService } from './onda2-facilities.service';
import { Onda2PulseService } from './onda2-pulse.service';
import {
  AssignWorkOrderDto,
  ChangeWorkOrderStatusDto,
  CloseRatioBreachDto,
  CreateFacilityAssetDto,
  CompleteInspectionDto,
  CreateComplianceEvidenceDto,
  CreateComplianceRequirementDto,
  CreateFacilitySpaceDto,
  CreateInspectionDto,
  CreateMaintenanceRequestDto,
  CreateNonconformityDto,
  CreatePreventivePlanDto,
  CreatePresenceSessionDto,
  CreateRatioPolicyDto,
  CreateRatioSnapshotDto,
  CreateStaffingAssignmentDto,
  CreateWorkOrderDto,
  VerifyNonconformityDto,
  Onda2ListQueryDto,
  PulseQueryDto,
  RecordPresenceEventDto,
  TriageMaintenanceRequestDto,
} from './onda2.dto';

@Controller('onda2')
@UseGuards(JwtAuthGuard, RolesGuard)
export class Onda2Controller {
  constructor(
    private readonly pulse: Onda2PulseService,
    private readonly coverage: Onda2CoverageService,
    private readonly facilities: Onda2FacilitiesService,
    private readonly compliance: Onda2ComplianceService,
  ) {}

  @Get('pulse')
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  commandCenter(@Query() query: PulseQueryDto, @CurrentUser() user: JwtPayload) {
    return this.pulse.commandCenter(query, user);
  }

  @Get('pulse/events')
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  events(@Query() query: PulseQueryDto, @CurrentUser() user: JwtPayload) {
    return this.pulse.listEvents(query, user);
  }

  @Post('pulse/sessions')
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.DEVELOPER)
  createPresenceSession(@Body() dto: CreatePresenceSessionDto, @CurrentUser() user: JwtPayload) {
    return this.pulse.createSession(dto, user);
  }

  @Post('pulse/events')
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.DEVELOPER)
  recordPresenceEvent(@Body() dto: RecordPresenceEventDto, @CurrentUser() user: JwtPayload) {
    return this.pulse.recordEvent(dto, user);
  }

  @Patch('pulse/sessions/:id/close')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  closePresenceSession(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.pulse.closeSession(id, user);
  }

  @Get('coverage/policies')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listRatioPolicies(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.listRatioPolicies(query, user);
  }

  @Post('coverage/policies')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createRatioPolicy(@Body() dto: CreateRatioPolicyDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.createRatioPolicy(dto, user);
  }

  @Post('coverage/policies/:id/publish')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  publishRatioPolicy(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coverage.publishRatioPolicy(id, user);
  }

  @Get('coverage/snapshots')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listRatioSnapshots(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.listSnapshots(query, user);
  }

  @Post('coverage/snapshots')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createRatioSnapshot(@Body() dto: CreateRatioSnapshotDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.createSnapshot(dto, user);
  }

  @Get('coverage/breaches')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listRatioBreaches(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.listBreaches(query, user);
  }

  @Patch('coverage/breaches/:id/acknowledge')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  acknowledgeRatioBreach(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coverage.acknowledgeBreach(id, user);
  }

  @Patch('coverage/breaches/:id/resolve')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  resolveRatioBreach(@Param('id') id: string, @Body() dto: CloseRatioBreachDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.resolveBreach(id, dto, user);
  }

  @Get('coverage/staffing')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listStaffing(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.listStaffing(query, user);
  }

  @Post('coverage/staffing')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createStaffing(@Body() dto: CreateStaffingAssignmentDto, @CurrentUser() user: JwtPayload) {
    return this.coverage.createStaffingAssignment(dto, user);
  }

  @Post('coverage/staffing/:id/publish')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  publishStaffing(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coverage.publishStaffingAssignment(id, user);
  }

  @Get('facilities/summary')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  facilitiesSummary(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.facilitiesSummary(query, user);
  }

  @Get('facilities/spaces')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listSpaces(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.listSpaces(query, user);
  }

  @Post('facilities/spaces')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createSpace(@Body() dto: CreateFacilitySpaceDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.createSpace(dto, user);
  }

  @Get('facilities/assets')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listAssets(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.listAssets(query, user);
  }

  @Post('facilities/assets')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createAsset(@Body() dto: CreateFacilityAssetDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.createAsset(dto, user);
  }

  @Get('facilities/requests')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listMaintenanceRequests(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.listMaintenanceRequests(query, user);
  }

  @Post('facilities/requests')
  @RequireRoles(RoleLevel.PROFESSOR, RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createMaintenanceRequest(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.createMaintenanceRequest(dto, user);
  }

  @Patch('facilities/requests/:id/triage')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  triageMaintenanceRequest(@Param('id') id: string, @Body() dto: TriageMaintenanceRequestDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.triageMaintenanceRequest(id, dto, user);
  }

  @Get('facilities/work-orders')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listWorkOrders(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.listWorkOrders(query, user);
  }

  @Post('facilities/work-orders')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createWorkOrder(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.createWorkOrder(dto, user);
  }

  @Patch('facilities/work-orders/:id/assign')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  assignWorkOrder(@Param('id') id: string, @Body() dto: AssignWorkOrderDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.assignWorkOrder(id, dto, user);
  }

  @Patch('facilities/work-orders/:id/status')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  changeWorkOrderStatus(@Param('id') id: string, @Body() dto: ChangeWorkOrderStatusDto, @CurrentUser() user: JwtPayload) {
    return this.facilities.changeWorkOrderStatus(id, dto, user);
  }

  @Get('preventive/plans')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listPreventivePlans(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.listPreventivePlans(query, user);
  }

  @Post('preventive/plans')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createPreventivePlan(@Body() dto: CreatePreventivePlanDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.createPreventivePlan(dto, user);
  }

  @Post('preventive/plans/:id/tasks')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  generatePreventiveTask(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.compliance.generatePreventiveTask(id, user);
  }

  @Get('compliance/inspections')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listInspections(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.listInspections(query, user);
  }

  @Post('compliance/inspections')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createInspection(@Body() dto: CreateInspectionDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.createInspection(dto, user);
  }

  @Patch('compliance/inspections/:id/complete')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  completeInspection(@Param('id') id: string, @Body() dto: CompleteInspectionDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.completeInspection(id, dto, user);
  }

  @Get('compliance/nonconformities')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listNonconformities(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.listNonconformities(query, user);
  }

  @Post('compliance/nonconformities')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createNonconformity(@Body() dto: CreateNonconformityDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.createNonconformity(dto, user);
  }

  @Patch('compliance/nonconformities/:id/verify')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  verifyNonconformity(@Param('id') id: string, @Body() dto: VerifyNonconformityDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.verifyNonconformity(id, dto, user);
  }

  @Get('compliance/requirements')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listComplianceRequirements(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.listComplianceRequirements(query, user);
  }

  @Post('compliance/requirements')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createComplianceRequirement(@Body() dto: CreateComplianceRequirementDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.createComplianceRequirement(dto, user);
  }

  @Get('compliance/evidence')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.STAFF_CENTRAL, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  listComplianceEvidence(@Query() query: Onda2ListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.listComplianceEvidence(query, user);
  }

  @Post('compliance/evidence')
  @RequireRoles(RoleLevel.UNIDADE, RoleLevel.MANTENEDORA, RoleLevel.DEVELOPER)
  createComplianceEvidence(@Body() dto: CreateComplianceEvidenceDto, @CurrentUser() user: JwtPayload) {
    return this.compliance.createComplianceEvidence(dto, user);
  }
}
