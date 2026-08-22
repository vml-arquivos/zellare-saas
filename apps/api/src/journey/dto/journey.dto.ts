import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  JourneyActivityType,
  JourneyStage,
  Onda1LegalBasis,
} from "@prisma/client";

export class CreateJourneyProspectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  responsibleName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  childName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  declaredIdentityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  declaredIdentity?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  source!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  unitId!: string;

  @IsInt()
  @Min(0)
  @Max(240)
  ageGroupMinMonths!: number;

  @IsInt()
  @Min(0)
  @Max(240)
  ageGroupMaxMonths!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  period!: string;

  @IsOptional()
  @IsDateString()
  desiredDate?: string;

  @IsBoolean()
  consentCapture!: boolean;

  @IsBoolean()
  consentContact!: boolean;

  @IsOptional()
  @IsEnum(Onda1LegalBasis)
  captureLegalBasis?: Onda1LegalBasis;

  @IsOptional()
  @IsEnum(Onda1LegalBasis)
  contactLegalBasis?: Onda1LegalBasis;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  consentPolicyVersion?: string;

  @IsOptional()
  @IsDateString()
  retentionUntil?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class JourneyListQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsEnum(JourneyStage)
  stage?: JourneyStage;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset = 0;
}

export class ChangeJourneyStageDto {
  @IsEnum(JourneyStage)
  toStage!: JourneyStage;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class CreateJourneyActivityDto {
  @IsEnum(JourneyActivityType)
  type!: JourneyActivityType;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class CreateJourneyTaskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedTo?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class CreateJourneyVisitDto {
  @IsString()
  prospectId!: string;

  @IsString()
  unitId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class RescheduleJourneyVisitDto {
  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class JourneyVisitActionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateJourneyPolicyDto {
  @IsString()
  unitId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  programKey!: string;

  @IsInt()
  @Min(0)
  @Max(240)
  ageGroupMinMonths!: number;

  @IsInt()
  @Min(0)
  @Max(240)
  ageGroupMaxMonths!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  period!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  version!: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsObject()
  priorityDefinition!: Record<string, unknown>;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class PublishJourneyPolicyDto {
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class JoinJourneyWaitlistDto {
  @IsString()
  unitId!: string;

  @IsString()
  prospectId!: string;

  @IsString()
  policyId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class CreateJourneyOfferDto {
  @IsString()
  unitId!: string;

  @IsString()
  prospectId!: string;

  @IsString()
  classroomId!: string;

  @IsOptional()
  @IsString()
  waitlistEntryId?: string;

  @IsDateString()
  reservationExpiresAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class DecideJourneyOfferDto {
  @IsEnum(["accept", "reject"] as const)
  decision!: "accept" | "reject";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class JourneyDuplicateReviewDto {
  @IsEnum(["confirm", "reject"] as const)
  decision!: "confirm" | "reject";

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;
}

export class JourneyDashboardQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;
}

export class JourneyPrivacyActionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  idempotencyKey!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class JourneyRetentionDto extends JourneyPrivacyActionDto {
  @IsDateString()
  retentionUntil!: string;
}
