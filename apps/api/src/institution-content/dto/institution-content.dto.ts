import { IsEnum, IsString, IsOptional, Length } from 'class-validator';

export enum ContentUploadType {
  PLANO_DE_AULA = 'PLANO_DE_AULA',
  PROJETO_PEDAGOGICO = 'PROJETO_PEDAGOGICO',
  MATERIAL_DIDATICO = 'MATERIAL_DIDATICO',
  CURRICULO_PROPRIO = 'CURRICULO_PROPRIO',
  OUTRO = 'OUTRO',
}

export class CreateContentUploadDto {
  @IsEnum(ContentUploadType)
  type: ContentUploadType;

  @IsString()
  @Length(1, 255)
  title: string;
}

export class ReviewContentUploadDto {
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  // Correções manuais no que a IA extraiu, antes de aprovar
  @IsOptional()
  extractedDataOverride?: Record<string, any>;
}
