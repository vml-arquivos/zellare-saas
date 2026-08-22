import { Type } from "class-transformer";
import { Onda1LegalBasis } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const SORT_DIRECTIONS = ["asc", "desc"] as const;

export class FamilyChildrenQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsIn(["firstName", "lastName", "createdAt"])
  sortBy: "firstName" | "lastName" | "createdAt" = "firstName";

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortOrder: "asc" | "desc" = "asc";
}

export class FamilyGuardianCandidatesQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsIn(["firstName", "lastName", "createdAt"])
  sortBy: "firstName" | "lastName" | "createdAt" = "firstName";

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortOrder: "asc" | "desc" = "asc";
}

export class FamilyQueryDto {
  @IsOptional()
  @IsString()
  childId?: string;
}

export class FamilyTimelineQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateGuardianLinkDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  relationship!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewTimeline?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewDevelopment?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewHealth?: boolean;

  @IsOptional()
  @IsEnum(Onda1LegalBasis)
  legalBasis?: Onda1LegalBasis;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  consentPolicyVersion?: string;

  @IsOptional()
  @IsDateString()
  retentionUntil?: string;
}

export class RevokeGuardianDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CreateFamilyMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  recipientUserId?: string;
}
