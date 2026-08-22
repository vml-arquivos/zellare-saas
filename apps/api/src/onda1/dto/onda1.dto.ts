import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  EvidenceSensitivity,
  Onda1ConsentDecision,
  Onda1ConsentPurpose,
  Onda1LegalBasis,
  Onda1ContributionType,
  Onda1ConversationStatus,
  Onda1GoalStatus,
  Onda1GoalType,
  Onda1MessagePriority,
  Onda1ReviewPriority,
  Onda1ReviewTaskStatus,
  Onda1SupportStatus,
} from "@prisma/client";

export class EvidenceLoopQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  evidenceType?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}

export class ReviewQueueQueryDto {
  @IsOptional()
  @IsEnum(Onda1ReviewTaskStatus)
  status?: Onda1ReviewTaskStatus;

  @IsOptional()
  @IsEnum(Onda1ReviewPriority)
  priority?: Onda1ReviewPriority;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}

export class CreateReviewTaskDto {
  @IsOptional()
  @IsEnum(Onda1ReviewPriority)
  priority?: Onda1ReviewPriority;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  requestNote?: string;
}

export class UpdateReviewTaskDto {
  @IsEnum(Onda1ReviewTaskStatus)
  status!: Onda1ReviewTaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  decisionNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actionTaken?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateGoalDto {
  @IsEnum(Onda1GoalType)
  goalType!: Onda1GoalType;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  frameworkId?: string;

  @IsOptional()
  @IsString()
  frameworkObjectiveId?: string;

  @IsOptional()
  criteria?: unknown;

  @IsOptional()
  @IsBoolean()
  familyVisible?: boolean;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsEnum(Onda1GoalStatus)
  status?: Onda1GoalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  criteria?: unknown;

  @IsOptional()
  @IsBoolean()
  familyVisible?: boolean;
}

export class CreateSupportActionDto {
  @IsString()
  @MaxLength(10000)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  context?: string;

  @IsString()
  executor!: string;

  @IsOptional()
  @IsString()
  evidenceId?: string;

  @IsOptional()
  @IsDateString()
  attemptedAt?: string;
}

export class UpdateSupportOutcomeDto {
  @IsEnum(Onda1SupportStatus)
  status!: Onda1SupportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  observedResponse?: string;
}

export class CreateEvidenceLinkDto {
  @IsString()
  @MaxLength(60)
  targetType!: string;

  @IsString()
  targetId!: string;

  @IsString()
  @MaxLength(60)
  relationType!: string;

  @IsOptional()
  context?: unknown;
}

export class FamilyFeedQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}

export class CreateFamilyConversationDto {
  @IsString()
  childId!: string;

  @IsString()
  @MaxLength(255)
  subject!: string;

  @IsOptional()
  @IsEnum(Onda1MessagePriority)
  priority?: Onda1MessagePriority;
}

export class UpdateFamilyConversationDto {
  @IsEnum(Onda1ConversationStatus)
  status!: Onda1ConversationStatus;
}

export class CreateFamilyMessageDto {
  @IsString()
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsEnum(Onda1MessagePriority)
  priority?: Onda1MessagePriority;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMutationId?: string;
}

export class CreateFamilyContributionDto {
  @IsString()
  childId!: string;

  @IsEnum(Onda1ContributionType)
  contributionType!: Onda1ContributionType;

  @IsString()
  @MaxLength(20000)
  content!: string;

  @IsOptional()
  structuredData?: unknown;

  @IsOptional()
  @IsString()
  goalId?: string;

  @IsOptional()
  @IsString()
  evidenceId?: string;
}

export class CreateConsentGrantDto {
  @IsString()
  childId!: string;

  @IsEnum(Onda1ConsentPurpose)
  purpose!: Onda1ConsentPurpose;

  @IsEnum(Onda1ConsentDecision)
  decision!: Onda1ConsentDecision;

  @IsOptional()
  @IsEnum(Onda1LegalBasis)
  legalBasis?: Onda1LegalBasis;

  @IsString()
  @MaxLength(80)
  policyVersion!: string;

  @IsString()
  @MaxLength(20000)
  textPresented!: string;

  @IsString()
  @MaxLength(80)
  origin!: string;

  @IsOptional()
  proof?: unknown;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class CreatePublicationDto {
  @IsString()
  childId!: string;

  @IsString()
  @MaxLength(80)
  sourceType!: string;

  @IsString()
  sourceId!: string;

  @IsString()
  @MaxLength(80)
  audienceType!: string;

  @IsOptional()
  @IsString()
  audienceUserId?: string;

  snapshot!: unknown;

  @IsEnum(EvidenceSensitivity)
  sensitivity!: EvidenceSensitivity;

  @IsOptional()
  @IsString()
  consentGrantId?: string;
}

export class CreateAcknowledgmentDto {
  @IsString()
  childId!: string;

  @IsString()
  @MaxLength(60)
  recordType!: string;

  @IsString()
  recordId!: string;

  @IsString()
  @MaxLength(60)
  kind!: string;

  @IsOptional()
  metadata?: unknown;
}

export class UpsertCommunicationPreferenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string;

  @IsOptional()
  channels?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  quietHoursEnd?: string;

  @IsOptional()
  @IsBoolean()
  importantAlerts?: boolean;
}
