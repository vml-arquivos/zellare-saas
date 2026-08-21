export type LongitudinalState =
  | 'SEM_DADOS'
  | 'OBSERVAR'
  | 'MONITORAR'
  | 'REVISAR'
  | 'CONVERSAR_COM_FAMILIA'
  | 'ENCAMINHAR_AVALIACAO'
  | 'URGENTE'
  | 'CONFIRMADO_POR_PROFISSIONAL'
  | 'RESOLVIDO/ACOMPANHANDO';

type EvidenceLike = {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceVersion?: number | null;
  capturedAt: Date | string;
  evidenceType: string;
  content?: string | null;
  structuredData?: unknown;
  tags?: unknown;
};

type StructuredObservation = {
  source?: string;
  schemaVersion?: number;
  context?: string;
  opportunity?: string;
  domain?: string;
  indicatorId?: string;
  level?: string;
  support?: string;
  response?: string;
  durationSeconds?: number;
  frequency?: number;
  objectiveNote?: string;
  teacherConcern?: boolean;
  recordedAt?: string;
  abc?: {
    behavior?: string;
    intensity?: number;
    frequency?: number;
  };
};

type ObservationFact = {
  evidence: EvidenceLike;
  domain: string;
  indicatorId: string;
  context: string | null;
  opportunity: string | null;
  level: string | null;
  support: string | null;
  response: string | null;
  durationSeconds: number | null;
  frequency: number | null;
  teacherConcern: boolean;
  intensity: number | null;
  isStructured: boolean;
};

export type LongitudinalSignal = {
  id: string;
  domain: string;
  indicatorId: string;
  state: LongitudinalState;
  explanation: string;
  nextAction: string;
  window: { startDate: string; endDate: string };
  recurrence: {
    totalRecords: number;
    eligibleRecords: number;
    attentionRecords: number;
    observedRecords: number;
    refusalRecords: number;
    noOpportunityRecords: number;
  };
  persistence: {
    firstObservedAt: string | null;
    lastObservedAt: string | null;
    days: number;
  };
  contexts: string[];
  supports: {
    attempted: string[];
    responses: string[];
    effectiveRecords: number;
    ineffectiveRecords: number;
  };
  impactSignals: {
    teacherConcernRecords: number;
    highIntensityRecords: number;
    noResponseRecords: number;
    note: string;
  };
  contradictoryEvidence: Array<{
    sourceType: string;
    sourceId: string;
    capturedAt: string;
    context: string | null;
    level: string | null;
  }>;
  provenance: Array<{
    evidenceId: string;
    sourceType: string;
    sourceId: string;
    capturedAt: string;
    sourceVersion: number | null;
    evidenceType: string;
    isStructured: boolean;
  }>;
  confidence: {
    level: 'BAIXA' | 'MEDIA' | 'ALTA';
    reason: string;
  };
  governance: {
    diagnosticInference: false;
    humanReviewRequired: true;
    ruleVersion: string;
  };
};

const ATTENTION_LEVELS = new Set(['REQUER_ATENCAO']);
const OBSERVED_OPPORTUNITIES = new Set(['OBSERVADA', 'RECUSA', 'NAO_CONCLUSIVA']);
const POSITIVE_LEVELS = new Set(['ALCANCADO']);
const EFFECTIVE_RESPONSES = new Set(['RESPONDEU_BEM']);
const INEFFECTIVE_RESPONSES = new Set(['NAO_RESPONDEU']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDate(value: Date | string): Date | null {
  const result = value instanceof Date ? value : new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function extractStructured(data: unknown): StructuredObservation | null {
  const record = asRecord(data);
  if (!record) return null;
  const direct = asRecord(record.structuredObservation);
  const aiContext = asRecord(record.aiContext);
  const nested = aiContext ? asRecord(aiContext.structuredObservation) : null;
  const candidate = direct ?? nested ?? (record.source === 'daily-collection' ? record : null);
  return candidate as StructuredObservation | null;
}

function toFact(evidence: EvidenceLike): ObservationFact | null {
  const data = asRecord(evidence.structuredData);
  const structured = extractStructured(evidence.structuredData);
  if (structured?.domain && structured.indicatorId) {
    return {
      evidence,
      domain: structured.domain,
      indicatorId: structured.indicatorId,
      context: asText(structured.context),
      opportunity: asText(structured.opportunity),
      level: asText(structured.level),
      support: asText(structured.support),
      response: asText(structured.response),
      durationSeconds: asNumber(structured.durationSeconds),
      frequency: asNumber(structured.frequency) ?? asNumber(structured.abc?.frequency),
      teacherConcern: structured.teacherConcern === true,
      intensity: asNumber(structured.abc?.intensity),
      isStructured: true,
    };
  }

  if (evidence.sourceType === 'DEVELOPMENT_OBSERVATION') {
    const domain = asText(data?.category) ?? evidence.evidenceType ?? 'GERAL';
    return {
      evidence,
      domain,
      indicatorId: `${domain}:legacy`,
      context: null,
      opportunity: null,
      level: null,
      support: null,
      response: null,
      durationSeconds: null,
      frequency: null,
      teacherConcern: Boolean(asText(data?.developmentAlerts)),
      intensity: null,
      isStructured: false,
    };
  }

  return null;
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function stateFor(records: ObservationFact[], attention: number, contexts: Set<string>, urgent: boolean): LongitudinalState {
  if (urgent) return 'URGENTE';
  if (records.length === 0) return 'SEM_DADOS';
  if (attention === 0) return records.some((record) => POSITIVE_LEVELS.has(record.level ?? '')) ? 'OBSERVAR' : 'MONITORAR';
  if (attention >= 2 && contexts.size >= 2) return 'REVISAR';
  return attention >= 2 ? 'MONITORAR' : 'OBSERVAR';
}

function nextActionFor(state: LongitudinalState, eligibleRecords: number): string {
  if (state === 'URGENTE') return 'Acionar o protocolo institucional aprovado imediatamente; não aguardar análise automática.';
  if (state === 'SEM_DADOS') {
    return eligibleRecords === 0
      ? 'Registrar uma oportunidade real; não interpretar ausência de oportunidade como atraso.'
      : 'Registrar oportunidades suficientes antes de interpretar o padrão.';
  }
  if (state === 'REVISAR') return 'Revisar com a coordenação, complementar contexto e registrar o suporte tentado.';
  if (state === 'MONITORAR') return 'Continuar observando em contextos variados e registrar resposta aos suportes.';
  if (eligibleRecords === 0) return 'Registrar uma oportunidade real; não interpretar ausência de oportunidade como atraso.';
  return 'Manter registro factual e observar a próxima oportunidade.';
}

function confidenceFor(records: ObservationFact[], eligibleRecords: number, contexts: Set<string>) {
  if (records.length >= 5 && eligibleRecords >= 3 && contexts.size >= 2) {
    return { level: 'ALTA' as const, reason: 'Múltiplas fontes observacionais, oportunidades elegíveis e contextos registrados.' };
  }
  if (records.length >= 2 || eligibleRecords >= 1) {
    return { level: 'MEDIA' as const, reason: 'Há evidência observacional, mas a janela ou diversidade de contextos ainda é limitada.' };
  }
  return { level: 'BAIXA' as const, reason: 'Há poucos registros ou oportunidade insuficiente para uma leitura longitudinal.' };
}

export function analyzeLongitudinalEvidence(
  evidence: EvidenceLike[],
  window: { startDate: Date; endDate: Date },
): {
  signals: LongitudinalSignal[];
  coverage: {
    totalEvidence: number;
    structuredObservationRecords: number;
    legacyObservationRecords: number;
    opportunityRecords: number;
    observedOpportunityRecords: number;
    noOpportunityRecords: number;
    coverageRate: number | null;
  };
} {
  const facts = evidence.map(toFact).filter((fact): fact is ObservationFact => Boolean(fact));
  const groups = new Map<string, ObservationFact[]>();

  for (const fact of facts) {
    const key = `${fact.domain}::${fact.indicatorId}`;
    const group = groups.get(key) ?? [];
    group.push(fact);
    groups.set(key, group);
  }

  const signals: LongitudinalSignal[] = [...groups.entries()].map(([key, records]) => {
    const eligible = records.filter((record) => record.opportunity !== 'NAO_HOUVE_OPORTUNIDADE');
    const attentionRecords = eligible.filter((record) => ATTENTION_LEVELS.has(record.level ?? '') || record.teacherConcern);
    const observedRecords = eligible.filter((record) => OBSERVED_OPPORTUNITIES.has(record.opportunity ?? '') || record.opportunity === null);
    const contexts = new Set(records.map((record) => record.context).filter((value): value is string => Boolean(value)));
    const dates = records.map((record) => asDate(record.evidence.capturedAt)).filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime());
    const firstObservedAt = dates[0] ?? null;
    const lastObservedAt = dates[dates.length - 1] ?? null;
    const days = firstObservedAt && lastObservedAt
      ? Math.max(0, Math.round((lastObservedAt.getTime() - firstObservedAt.getTime()) / 86_400_000))
      : 0;
    const contradictoryEvidence = eligible
      .filter((record) => POSITIVE_LEVELS.has(record.level ?? '') && !ATTENTION_LEVELS.has(record.level ?? ''))
      .slice(0, 20)
      .map((record) => ({
        sourceType: record.evidence.sourceType,
        sourceId: record.evidence.sourceId,
        capturedAt: asDate(record.evidence.capturedAt)?.toISOString() ?? String(record.evidence.capturedAt),
        context: record.context,
        level: record.level,
      }));
    const attempted = [...new Set(records.map((record) => record.support).filter((value): value is string => Boolean(value) && value !== 'NENHUM'))];
    const responses = [...new Set(records.map((record) => record.response).filter((value): value is string => Boolean(value)))];
    const effectiveRecords = records.filter((record) => EFFECTIVE_RESPONSES.has(record.response ?? '')).length;
    const ineffectiveRecords = records.filter((record) => INEFFECTIVE_RESPONSES.has(record.response ?? '')).length;
    const urgent = records.some((record) => record.evidence.evidenceType === 'ALERTA_DERIVADO' && String(asRecord(record.evidence.structuredData)?.severidade ?? '').toUpperCase() === 'CRITICA');
    const state = stateFor(eligible, attentionRecords.length, contexts, urgent);
    const domain = records[0].domain;
    const indicatorId = records[0].indicatorId;
    const signalId = `signal:${domain}:${indicatorId}`;
    const explanation = attentionRecords.length > 0
      ? `${attentionRecords.length} registro(s) com sinal operacional de atenção em ${contexts.size || 1} contexto(s); há ${contradictoryEvidence.length} evidência(s) favorável(is) para revisão contextual.`
      : `${records.length} registro(s) em ${contexts.size || 1} contexto(s), sem sinal automático de diagnóstico.`;

    return {
      id: signalId,
      domain,
      indicatorId,
      state,
      explanation,
      nextAction: nextActionFor(state, eligible.length),
      window: { startDate: window.startDate.toISOString(), endDate: window.endDate.toISOString() },
      recurrence: {
        totalRecords: records.length,
        eligibleRecords: eligible.length,
        attentionRecords: attentionRecords.length,
        observedRecords: observedRecords.length,
        refusalRecords: records.filter((record) => record.opportunity === 'RECUSA').length,
        noOpportunityRecords: records.filter((record) => record.opportunity === 'NAO_HOUVE_OPORTUNIDADE').length,
      },
      persistence: { firstObservedAt: iso(firstObservedAt), lastObservedAt: iso(lastObservedAt), days },
      contexts: [...contexts].sort(),
      supports: { attempted, responses, effectiveRecords, ineffectiveRecords },
      impactSignals: {
        teacherConcernRecords: records.filter((record) => record.teacherConcern).length,
        highIntensityRecords: records.filter((record) => (record.intensity ?? 0) >= 4).length,
        noResponseRecords: records.filter((record) => record.response === 'NAO_RESPONDEU').length,
        note: 'Sinais operacionais descritivos; não equivalem a diagnóstico nem substituem avaliação humana.',
      },
      contradictoryEvidence,
      provenance: records.map((record) => ({
        evidenceId: record.evidence.id,
        sourceType: record.evidence.sourceType,
        sourceId: record.evidence.sourceId,
        capturedAt: asDate(record.evidence.capturedAt)?.toISOString() ?? String(record.evidence.capturedAt),
        sourceVersion: record.evidence.sourceVersion ?? null,
        evidenceType: record.evidence.evidenceType,
        isStructured: record.isStructured,
      })),
      confidence: confidenceFor(records, eligible.length, contexts),
      governance: {
        diagnosticInference: false,
        humanReviewRequired: true,
        ruleVersion: 'longitudinal-descriptive-v1',
      },
    };
  });

  const opportunityRecords = facts.filter((fact) => fact.opportunity !== null).length;
  const observedOpportunityRecords = facts.filter((fact) => fact.opportunity && OBSERVED_OPPORTUNITIES.has(fact.opportunity)).length;
  const noOpportunityRecords = facts.filter((fact) => fact.opportunity === 'NAO_HOUVE_OPORTUNIDADE').length;

  return {
    signals: signals.sort((a, b) => b.recurrence.attentionRecords - a.recurrence.attentionRecords || a.domain.localeCompare(b.domain)),
    coverage: {
      totalEvidence: evidence.length,
      structuredObservationRecords: facts.filter((fact) => fact.isStructured).length,
      legacyObservationRecords: facts.filter((fact) => !fact.isStructured).length,
      opportunityRecords,
      observedOpportunityRecords,
      noOpportunityRecords,
      coverageRate: opportunityRecords > 0 ? Math.round((observedOpportunityRecords / opportunityRecords) * 100) : null,
    },
  };
}
