import { analyzeLongitudinalEvidence } from './longitudinal-analysis';

const window = {
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2026-08-31T23:59:59.000Z'),
};

function diaryEvidence(id: string, capturedAt: string, observation: Record<string, unknown>) {
  return {
    id: `evidence-${id}`,
    sourceType: 'DIARY_EVENT',
    sourceId: `diary-${id}`,
    sourceVersion: 2,
    capturedAt: new Date(capturedAt),
    evidenceType: 'DESENVOLVIMENTO',
    structuredData: { aiContext: { structuredObservation: observation } },
  };
}

describe('analyzeLongitudinalEvidence', () => {
  it('não converte ausência de oportunidade em atraso e indica SEM_DADOS', () => {
    const result = analyzeLongitudinalEvidence([
      diaryEvidence('1', '2026-08-10T10:00:00.000Z', {
        source: 'daily-collection', schemaVersion: 2, context: 'RODA', opportunity: 'NAO_HOUVE_OPORTUNIDADE',
        domain: 'linguagem', indicatorId: 'fala-01', level: 'EM_DESENVOLVIMENTO', support: 'NENHUM', response: 'NAO_CONCLUSIVO',
      }),
    ], window);

    expect(result.coverage).toMatchObject({ opportunityRecords: 1, observedOpportunityRecords: 0, noOpportunityRecords: 1, coverageRate: 0 });
    expect(result.signals[0]).toMatchObject({
      state: 'SEM_DADOS',
      nextAction: 'Registrar uma oportunidade real; não interpretar ausência de oportunidade como atraso.',
      recurrence: { eligibleRecords: 0, attentionRecords: 0, noOpportunityRecords: 1 },
      governance: { diagnosticInference: false, humanReviewRequired: true, ruleVersion: 'longitudinal-descriptive-v1' },
    });
  });

  it('gera sinal explicável com recorrência, contextos, suportes e evidência contrária', () => {
    const records = [
      diaryEvidence('1', '2026-08-03T10:00:00.000Z', {
        source: 'daily-collection', schemaVersion: 2, context: 'RODA', opportunity: 'OBSERVADA',
        domain: 'linguagem', indicatorId: 'fala-01', level: 'REQUER_ATENCAO', support: 'MODELAGEM', response: 'NAO_RESPONDEU',
        teacherConcern: true, abc: { behavior: 'Não respondeu ao convite', intensity: 4, frequency: 2 },
      }),
      diaryEvidence('2', '2026-08-15T10:00:00.000Z', {
        source: 'daily-collection', schemaVersion: 2, context: 'TRANSICAO', opportunity: 'RECUSA',
        domain: 'linguagem', indicatorId: 'fala-01', level: 'REQUER_ATENCAO', support: 'PAUSA', response: 'RESPONDEU_PARCIALMENTE',
        teacherConcern: true, frequency: 3,
      }),
      diaryEvidence('3', '2026-08-25T10:00:00.000Z', {
        source: 'daily-collection', schemaVersion: 2, context: 'RODA', opportunity: 'OBSERVADA',
        domain: 'linguagem', indicatorId: 'fala-01', level: 'ALCANCADO', support: 'MEDIACAO_ADULTO', response: 'RESPONDEU_BEM',
      }),
    ];

    const result = analyzeLongitudinalEvidence(records, window);
    const signal = result.signals[0];

    expect(signal).toMatchObject({
      state: 'REVISAR',
      recurrence: { totalRecords: 3, eligibleRecords: 3, attentionRecords: 2, observedRecords: 3, refusalRecords: 1 },
      contexts: ['RODA', 'TRANSICAO'],
      supports: {
        attempted: ['MODELAGEM', 'PAUSA', 'MEDIACAO_ADULTO'],
        responses: ['NAO_RESPONDEU', 'RESPONDEU_PARCIALMENTE', 'RESPONDEU_BEM'],
        effectiveRecords: 1,
        ineffectiveRecords: 1,
      },
      contradictoryEvidence: [{ sourceType: 'DIARY_EVENT', sourceId: 'diary-3', level: 'ALCANCADO' }],
      impactSignals: { teacherConcernRecords: 2, highIntensityRecords: 1, noResponseRecords: 1 },
      confidence: { level: 'MEDIA' },
      governance: { diagnosticInference: false, humanReviewRequired: true },
    });
    expect(signal.explanation).toContain('2 registro(s)');
    expect(signal.nextAction).toContain('coordenação');
  });

  it('mantém observação legada como evidência suplementar sem inventar campos estruturados', () => {
    const result = analyzeLongitudinalEvidence([
      {
        id: 'legacy-evidence', sourceType: 'DEVELOPMENT_OBSERVATION', sourceId: 'obs-1', capturedAt: new Date('2026-08-12T10:00:00.000Z'),
        evidenceType: 'COMPORTAMENTO', content: 'Participou da roda.', structuredData: { category: 'COMPORTAMENTO' },
      },
    ], window);

    expect(result.coverage).toMatchObject({ structuredObservationRecords: 0, legacyObservationRecords: 1, opportunityRecords: 0 });
    expect(result.signals[0]).toMatchObject({ state: 'MONITORAR', recurrence: { totalRecords: 1, eligibleRecords: 1, observedRecords: 1 } });
    expect(result.signals[0].provenance[0]).toMatchObject({ sourceType: 'DEVELOPMENT_OBSERVATION', isStructured: false });
  });
});
