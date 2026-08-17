import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
