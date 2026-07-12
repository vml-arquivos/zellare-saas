import { IsString, IsOptional, IsInt, Min, Max, IsArray } from 'class-validator';

export class GerarPlanoDeAulaDto {
  /** Objetivo(s) do framework pedagógico plugável a cobrir no plano — 1 ou mais */
  @IsArray()
  @IsString({ each: true })
  frameworkObjectiveIds: string[];

  /** Tema/projeto da semana, se a instituição trabalha por tema (ex: "Animais da fazenda") */
  @IsOptional()
  @IsString()
  tema?: string;

  /** Quantos dias letivos o plano deve cobrir */
  @IsInt()
  @Min(1)
  @Max(10)
  quantidadeDias: number;

  /** Idade da turma em meses */
  @IsInt()
  @Min(0)
  @Max(72)
  ageRangeMeses: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  numeroCriancas?: number;

  @IsOptional()
  @IsString()
  contextoAdicional?: string;

  /** ID de conteúdo já aprovado (InstitutionContentUpload) pra usar como inspiração/base */
  @IsOptional()
  @IsString()
  contentUploadId?: string;
}
