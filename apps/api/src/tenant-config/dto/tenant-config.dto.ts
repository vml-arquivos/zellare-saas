import { IsString, IsOptional, IsBoolean, Length, Matches } from 'class-validator';

export class UpsertTenantBrandingDto {
  @IsString()
  @Length(1, 255)
  displayName: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  slogan?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor deve ser um hex válido, ex: #1E3A8A' })
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor deve ser um hex válido, ex: #1E3A8A' })
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  customDomain?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  emailFromName?: string;

  @IsOptional()
  @IsString()
  emailFromAddress?: string;
}

export class SetFeatureFlagDto {
  @IsString()
  @Length(1, 100)
  flagKey: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  config?: Record<string, any>;
}
