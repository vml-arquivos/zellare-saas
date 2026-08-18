import { BadRequestException } from '@nestjs/common';
import {
  normalizeStructuredObservationContext,
  STRUCTURED_OBSERVATION_SCHEMA_VERSION,
} from './structured-observation';

describe('normalizeStructuredObservationContext', () => {
  const valid = {
    source: 'daily-collection',
    schemaVersion: STRUCTURED_OBSERVATION_SCHEMA_VERSION,
    context: 'TRANSICAO',
    opportunity: 'OBSERVADA',
    domain: 'REGULACAO_EMOCIONAL',
    indicatorId: 'ADAPTACAO_ROTINA',
    level: 'EM_DESENVOLVIMENTO',
    support: 'AVISO_VISUAL',
    response: 'RESPONDEU_BEM',
    durationSeconds: 90,
    frequency: 1,
    objectiveNote: 'Precisou de aviso visual antes da troca.',
    teacherConcern: false,
  };

  it('accepts and normalizes a versioned daily observation', () => {
    expect(normalizeStructuredObservationContext(valid)).toEqual({
      ...valid,
      recordedAt: undefined,
    });
  });

  it('keeps legacy aiContext payloads untouched by returning null', () => {
    expect(normalizeStructuredObservationContext({ source: 'legacy-diary', foo: 'bar' })).toBeNull();
    expect(normalizeStructuredObservationContext(undefined)).toBeNull();
  });

  it('rejects unsupported versions', () => {
    expect(() => normalizeStructuredObservationContext({ ...valid, schemaVersion: 1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid context values', () => {
    expect(() => normalizeStructuredObservationContext({ ...valid, context: 'CLINICO' })).toThrow(
      'contexto inválido',
    );
  });

  it('accepts a bounded ABC evidence payload', () => {
    expect(normalizeStructuredObservationContext({
      ...valid,
      abc: {
        antecedent: 'Mudança de atividade sem aviso visual',
        behavior: 'Chorou e afastou-se do grupo',
        consequence: 'Recebeu mediação e retomou parcialmente',
        intensity: 3,
        frequency: 1,
      },
    })?.abc).toEqual({
      antecedent: 'Mudança de atividade sem aviso visual',
      behavior: 'Chorou e afastou-se do grupo',
      consequence: 'Recebeu mediação e retomou parcialmente',
      intensity: 3,
      frequency: 1,
    });
  });

  it('rejects ABC without an observable behavior', () => {
    expect(() => normalizeStructuredObservationContext({ ...valid, abc: { antecedent: 'Transição' } })).toThrow(
      'comportamento observável',
    );
  });

  it('rejects excessive duration and frequency', () => {
    expect(() => normalizeStructuredObservationContext({ ...valid, durationSeconds: 90000 })).toThrow(
      'duração deve ser',
    );
    expect(() => normalizeStructuredObservationContext({ ...valid, frequency: 1001 })).toThrow(
      'frequência deve ser',
    );
  });
});
