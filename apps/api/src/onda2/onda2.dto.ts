import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  Onda2ApprovalStatus,
  Onda2AssetStatus,
  Onda2BreachStatus,
  Onda2ExecutionStatus,
  Onda2InspectionResult,
  Onda2MaintenanceRequestStatus,
  Onda2Priority,
  Onda2PresenceEventType,
  Onda2PresenceSessionStatus,
  Onda2RatioState,
  Onda2SpaceStatus,
  Onda2WorkOrderStatus,
} from '@prisma/client';

export class CreatePresenceSessionDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;

  @IsDateString()
  sessionDate!: string;

  @IsOptional()
  @IsEnum(Onda2PresenceSessionStatus)
  status?: Onda2PresenceSessionStatus;
}

export class RecordPresenceEventDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsString()
  subjectType!: string;

  @IsString()
  subjectId!: string;

  @IsEnum(Onda2PresenceEventType)
  eventType!: Onda2PresenceEventType;

  @IsISO8601()
  occurredAt!: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class CreateRatioPolicyDto {
  @IsString()
  unitId!: string;

  @IsString()
  name!: string;

  @IsString()
  jurisdiction!: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsObject()
  definition!: Record<string, unknown>;
}

export class CreateRatioSnapshotDto {
  @IsString()
  unitId!: string;

  @IsString()
  spaceId!: string;

  @IsISO8601()
  snapshotAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsInt()
  @Min(0)
  childCount!: number;

  @IsInt()
  @Min(0)
  requiredAdults!: number;

  @IsInt()
  @Min(0)
  validAdults!: number;

  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsString()
  ruleVersionId?: string;

  @IsOptional()
  @IsEnum(Onda2RatioState)
  state?: Onda2RatioState;

  @IsOptional()
  @IsObject()
  inputSnapshot?: Record<string, unknown>;
}

export class CreateStaffingAssignmentDto {
  @IsString()
  unitId!: string;

  @IsString()
  spaceId!: string;

  @IsString()
  employeeId!: string;

  @IsString()
  functionLabel!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CreateFacilitySpaceDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  spaceType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsEnum(Onda2SpaceStatus)
  status?: Onda2SpaceStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateFacilityAssetDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsString()
  code!: string;

  @IsString()
  qrToken!: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(Onda2AssetStatus)
  status?: Onda2AssetStatus;

  @IsOptional()
  @IsEnum(Onda2Priority)
  criticality?: Onda2Priority;

  @IsOptional()
  @IsDateString()
  warrantyEndsAt?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateMaintenanceRequestDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  category!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  impact?: string;

  @IsOptional()
  @IsEnum(Onda2Priority)
  priority?: Onda2Priority;

  @IsOptional()
  @IsBoolean()
  safetyRisk?: boolean;

  @IsString()
  idempotencyKey!: string;
}

export class TriageMaintenanceRequestDto {
  @IsEnum(Onda2MaintenanceRequestStatus)
  status!: Onda2MaintenanceRequestStatus;

  @IsOptional()
  @IsString()
  triageReason?: string;
}

export class CreateWorkOrderDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  category!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(Onda2Priority)
  priority?: Onda2Priority;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class ChangeWorkOrderStatusDto {
  @IsEnum(Onda2WorkOrderStatus)
  status!: Onda2WorkOrderStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  idempotencyKey!: string;
}

export class AssignWorkOrderDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class CloseRatioBreachDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class PulseQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class Onda2ListQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}

export class Onda2StatusQueryDto {
  @IsOptional()
  @IsEnum(Onda2ApprovalStatus)
  approvalStatus?: Onda2ApprovalStatus;

  @IsOptional()
  @IsEnum(Onda2BreachStatus)
  breachStatus?: Onda2BreachStatus;

  @IsOptional()
  @IsEnum(Onda2ExecutionStatus)
  executionStatus?: Onda2ExecutionStatus;
}


export class CreatePreventivePlanDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsString()
  name!: string;

  @IsString()
  scheduleType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string;
}

export class CreateInspectionDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CompleteInspectionDto {
  @IsEnum(Onda2InspectionResult)
  result!: Onda2InspectionResult;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateNonconformityDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  inspectionId?: string;

  @IsOptional()
  @IsString()
  workOrderId?: string;

  @IsString()
  code!: string;

  @IsEnum(Onda2Priority)
  severity!: Onda2Priority;

  @IsString()
  description!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class VerifyNonconformityDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateComplianceRequirementDto {
  @IsString()
  unitId!: string;

  @IsString()
  name!: string;

  @IsString()
  source!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  renewalDays?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CreateComplianceEvidenceDto {
  @IsString()
  unitId!: string;

  @IsString()
  requirementId!: string;

  @IsOptional()
  @IsString()
  inspectionId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
