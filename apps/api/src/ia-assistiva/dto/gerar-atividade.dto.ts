import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

export enum FaixaEtaria {
  EI01 = 'EI01', // Bebês (0 a 1 ano e 6 meses)
  EI02 = 'EI02', // Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)
  EI03 = 'EI03', // Crianças pequenas (4 anos a 5 anos e 11 meses)
}

export enum TipoAtividade {
  RODA_DE_CONVERSA = 'RODA_DE_CONVERSA',
  EXPLORACAO_SENSORIAL = 'EXPLORACAO_SENSORIAL',
  ATIVIDADE_PLASTICA = 'ATIVIDADE_PLASTICA',
  BRINCADEIRA_DIRIGIDA = 'BRINCADEIRA_DIRIGIDA',
  LEITURA_COMPARTILHADA = 'LEITURA_COMPARTILHADA',
  MUSICA_E_MOVIMENTO = 'MUSICA_E_MOVIMENTO',
  JOGO_SIMBOLICO = 'JOGO_SIMBOLICO',
  INVESTIGACAO = 'INVESTIGACAO',
  SEQUENCIA_DIDATICA = 'SEQUENCIA_DIDATICA',
  LIVRE = 'LIVRE',
}

export class GerarAtividadeDto {
  /**
   * Caminho NOVO (recomendado): aponta pra um objetivo de qualquer framework
   * pedagógico plugável (BNCC, Reggio, currículo próprio da instituição...).
   * Quando informado, a IA busca o texto do objetivo direto no banco.
   */
  @IsOptional()
  @IsString()
  frameworkObjectiveId?: string;

  /**
   * Caminho LEGADO (mantido por compatibilidade — COCRIS e quem já usa BNCC/DF
   * direto): campo de experiência e objetivos informados na mão.
   * Se frameworkObjectiveId for informado, estes três são ignorados.
   */
  @IsOptional()
  @IsString()
  campoDeExperiencia?: string;

  @IsOptional()
  @IsString()
  objetivoBNCC?: string;

  @IsOptional()
  @IsString()
  objetivoCurriculo?: string;

  /** Faixa etária da turma (legado, EI01/EI02/EI03) — opcional se ageRangeMeses for informado */
  @IsOptional()
  @IsEnum(FaixaEtaria)
  faixaEtaria?: FaixaEtaria;

  /** Idade da turma em meses — caminho novo, mais preciso que faixaEtaria, funciona pra qualquer framework */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(72)
  ageRangeMeses?: number;

  /** Tipo de atividade desejado (opcional — se não informado, a IA escolhe) */
  @IsOptional()
  @IsEnum(TipoAtividade)
  tipoAtividade?: TipoAtividade;

  /** Número de crianças na turma */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  numeroCriancas?: number;

  /** Contexto adicional do professor (ex: "temos poucos materiais", "crianças agitadas hoje") */
  @IsOptional()
  @IsString()
  contextoAdicional?: string;

  /** ID da entrada da matriz curricular (para vincular ao planejamento) */
  @IsOptional()
  @IsString()
  matrizEntradaId?: string;
}
