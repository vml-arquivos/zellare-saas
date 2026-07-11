import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPedagogicalFrameworkDto {
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isOfficial?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  // true = inclui também os frameworks globais da biblioteca (mantenedoraId nulo)
  // além dos que pertencem à mantenedora do usuário. Default: true.
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeGlobalLibrary?: boolean;
}
