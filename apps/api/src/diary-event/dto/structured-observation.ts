import { BadRequestException } from '@nestjs/common';

export const STRUCTURED_OBSERVATION_SCHEMA_VERSION = 2 as const;

const CONTEXTS = new Set([
  'RODA',
  'TRANSICAO',
  'BRINCADEIRA',
  'REFEICAO',
  'HIGIENE',
  'REPOUSO',
  'ATIVIDADE_DIRIGIDA',
  'LIVRE',
]);

const OPPORTUNITIES = new Set([
  'OBSERVADA',
  'NAO_HOUVE_OPORTUNIDADE',
  'RECUSA',
  'NAO_CONCLUSIVA',
]);

const LEVELS = new Set(['ALCANCADO', 'EM_DESENVOLVIMENTO', 'REQUER_ATENCAO']);
const SUPPORTS = new Set([
  'NENHUM',
  'AVISO_VISUAL',
  'MODELAGEM',
  'MEDIACAO_ADULTO',
  'PAUSA',
  'OUTRO',
]);
const RESPONSES = new Set([
  'RESPONDEU_BEM',
  'RESPONDEU_PARCIALMENTE',
  'NAO_RESPONDEU',
  'NAO_CONCLUSIVO',
]);

export interface AbcEvidence {
  antecedent?: string;
  behavior: string;
  consequence?: string;
  intensity?: number;
  frequency?: number;
}

export interface StructuredObservationEnvelope {
  source: 'daily-collection';
  schemaVersion: typeof STRUCTURED_OBSERVATION_SCHEMA_VERSION;
  context: string;
  opportunity: string;
  domain: string;
  indicatorId: string;
  level: string;
  support: string;
  response: string;
  durationSeconds?: number;
  frequency?: number;
  objectiveNote?: string;
  teacherConcern?: boolean;
  recordedAt?: string;
  abc?: AbcEvidence;
}

function optionalInteger(value: unknown, field: string, max: number): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    throw new BadRequestException(`${field} deve ser um número inteiro entre 0 e ${max}`);
  }
  return parsed;
}

function requiredEnum(value: unknown, field: string, allowed: Set<string>): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!allowed.has(normalized)) {
    throw new BadRequestException(`${field} inválido na coleta estruturada`);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

/**
 * Valida somente o envelope novo da coleta diária. Contextos legados de IA
 * permanecem aceitos para não quebrar eventos históricos ou integrações antigas.
 */
export function normalizeStructuredObservationContext(
  value: unknown,
): StructuredObservationEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const isStructured = input.source === 'daily-collection' || input.schemaVersion != null;
  if (!isStructured) return null;

  const schemaVersion = Number(input.schemaVersion);
  if (input.source !== 'daily-collection' || schemaVersion !== STRUCTURED_OBSERVATION_SCHEMA_VERSION) {
    throw new BadRequestException(
      `Versão de coleta estruturada não suportada. Use ${STRUCTURED_OBSERVATION_SCHEMA_VERSION}.`,
    );
  }

  const indicatorId = optionalText(input.indicatorId, 100);
  const domain = optionalText(input.domain, 100);
  if (!indicatorId || !domain) {
    throw new BadRequestException('A coleta estruturada exige domínio e indicador');
  }

  let abc: AbcEvidence | undefined;
  if (input.abc != null) {
    if (typeof input.abc !== 'object' || Array.isArray(input.abc)) {
      throw new BadRequestException('Evidência ABC inválida');
    }
    const abcInput = input.abc as Record<string, unknown>;
    const behavior = optionalText(abcInput.behavior, 500);
    if (!behavior) {
      throw new BadRequestException('A evidência ABC exige a descrição do comportamento observável');
    }
    abc = {
      antecedent: optionalText(abcInput.antecedent, 300),
      behavior,
      consequence: optionalText(abcInput.consequence, 300),
      intensity: abcInput.intensity == null ? undefined : optionalInteger(abcInput.intensity, 'intensidade', 5),
      frequency: abcInput.frequency == null ? undefined : optionalInteger(abcInput.frequency, 'frequência ABC', 1000),
    };
  }

  return {
    source: 'daily-collection',
    schemaVersion: STRUCTURED_OBSERVATION_SCHEMA_VERSION,
    context: requiredEnum(input.context, 'contexto', CONTEXTS),
    opportunity: requiredEnum(input.opportunity, 'oportunidade', OPPORTUNITIES),
    domain,
    indicatorId,
    level: requiredEnum(input.level, 'nível', LEVELS),
    support: requiredEnum(input.support, 'suporte', SUPPORTS),
    response: requiredEnum(input.response, 'resposta', RESPONSES),
    durationSeconds: optionalInteger(input.durationSeconds, 'duração', 24 * 60 * 60),
    frequency: optionalInteger(input.frequency, 'frequência', 1000),
    objectiveNote: optionalText(input.objectiveNote, 500),
    teacherConcern: Boolean(input.teacherConcern),
    recordedAt: optionalText(input.recordedAt, 40),
    ...(abc ? { abc } : {}),
  };
}
