import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { StatusAtendimento, TipoAtendimento } from '@prisma/client';

export class CreateAtendimentoDto {
  @IsString()
  childId!: string;

  @IsString()
  responsavelNome!: string;

  @IsOptional()
  @IsString()
  responsavelRelacao?: string;

  @IsOptional()
  @IsString()
  responsavelContato?: string;

  @IsEnum(TipoAtendimento)
  tipo!: TipoAtendimento;

  @IsDateString()
  dataAtendimento!: string;

  @IsString()
  assunto!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  encaminhamento?: string;

  @IsOptional()
  @IsBoolean()
  retornoNecessario?: boolean;

  @IsOptional()
  @IsDateString()
  dataRetorno?: string;
}

export class ListAtendimentoQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;

  @IsOptional()
  @IsString()
  childId?: string;

  @IsOptional()
  @IsEnum(StatusAtendimento)
  status?: StatusAtendimento;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
  @IsIn(['dataAtendimento', 'criadoEm'])
  sortBy: 'dataAtendimento' | 'criadoEm' = 'dataAtendimento';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class UpdateAtendimentoStatusDto {
  @IsEnum(StatusAtendimento)
  status!: StatusAtendimento;
}
