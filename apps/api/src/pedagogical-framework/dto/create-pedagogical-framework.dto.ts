import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  Length,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFrameworkObjectiveDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  code?: string;

  @IsInt()
  @Min(0)
  @Max(72) // 0 a 6 anos, em meses
  ageRangeMin: number;

  @IsInt()
  @Min(0)
  @Max(72)
  ageRangeMax: number;

  @IsString()
  text: string;
}

export class CreateFrameworkDimensionDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFrameworkObjectiveDto)
  objectives?: CreateFrameworkObjectiveDto[];
}

export class CreatePedagogicalFrameworkDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  region?: string;

  @IsOptional()
  @IsBoolean()
  isOfficial?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  sourceUrl?: string;

  // Permite criar o framework já com as dimensões/objetivos completos numa chamada só
  // (útil tanto pro seed inicial da BNCC quanto pra uma instituição montando o próprio currículo)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFrameworkDimensionDto)
  dimensions?: CreateFrameworkDimensionDto[];
}
