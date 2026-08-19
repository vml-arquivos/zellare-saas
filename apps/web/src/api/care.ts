import http from './http';

export interface CareChildOption {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  unitId?: string | null;
  classroomName?: string | null;
}

export interface CareEvidenceSummary {
  childId: string;
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  bySensitivity: Record<string, number>;
  lastCapturedAt?: string | null;
  governance: {
    generatedAt: string;
    evidenceOnly: boolean;
    humanReviewRequired: boolean;
    sourceTraceability: boolean;
  };
}

export interface CareOverview {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    unitId?: string | null;
    activeClassrooms: Array<{ id: string; name: string; code?: string | null; unitId: string }>;
  };
  health: {
    bloodType?: string | null;
    allergies?: boolean | string | null;
    medicalConditions?: boolean | string | null;
    medicationNeeds?: boolean | string | null;
    dietaryRestrictions: Array<{
      id: string;
      type: string;
      name: string;
      description?: string | null;
      severity?: string | null;
      allowedFoods?: string | null;
      forbiddenFoods?: string | null;
    }>;
  };
  development: Array<{
    id: string;
    category?: string | null;
    date: string;
    behaviorDescription?: string | null;
    socialInteraction?: string | null;
    emotionalState?: string | null;
    motorSkills?: string | null;
    cognitiveSkills?: string | null;
    languageSkills?: string | null;
    learningProgress?: string | null;
    interests?: string | null;
    challenges?: string | null;
    recommendations?: string | null;
    nextSteps?: string | null;
    psychologicalNotes?: string | null;
    healthNotes?: string | null;
    dietaryNotes?: string | null;
  }>;
  nutrition: Array<{
    id: string;
    statusCaso?: string | null;
    motivoAcompanhamento?: string | null;
    objetivos?: string | null;
    condutaAtual?: string | null;
    restricoesOperacionais?: string | null;
    substituicoesSeguras?: string | null;
    proximaReavaliacao?: string | null;
    atualizadoEm?: string | null;
  }>;
  alerts: Array<{
    id: string;
    tipo?: string | null;
    status?: string | null;
    titulo: string;
    descricao?: string | null;
    geradoEm: string;
    lidoEm?: string | null;
    resolvidoEm?: string | null;
  }>;
  familyCare: Array<{
    id: string;
    tipo?: string | null;
    status?: string | null;
    dataAtendimento: string;
    assunto?: string | null;
    retornoNecessario?: boolean | null;
    dataRetorno?: string | null;
    descricao?: string | null;
    encaminhamento?: string | null;
  }>;
  evidenceSummary?: CareEvidenceSummary | null;
  reports: Array<{
    id: string;
    period?: string | null;
    status?: string | null;
    publishedAt?: string | null;
    createdAt: string;
    content?: string | null;
  }>;
  governance: {
    generatedAt: string;
    readOnly: boolean;
    sensitiveFieldsMinimized: boolean;
    humanReviewRequired: boolean;
  };
}

function normalizeChildren(payload: unknown): CareChildOption[] {
  const raw = Array.isArray(payload)
    ? payload
    : (payload as { children?: unknown[]; data?: unknown[] } | null)?.children
      ?? (payload as { data?: unknown[] } | null)?.data
      ?? [];

  return (raw as Array<Record<string, unknown>>)
    .filter((child) => typeof child.id === 'string' && typeof child.firstName === 'string' && typeof child.lastName === 'string')
    .map((child) => ({
      id: child.id as string,
      firstName: child.firstName as string,
      lastName: child.lastName as string,
      dateOfBirth: typeof child.dateOfBirth === 'string' ? child.dateOfBirth : null,
      unitId: typeof child.unitId === 'string' ? child.unitId : null,
      classroomName: typeof child.classroomName === 'string'
        ? child.classroomName
        : (((child.enrollments as Array<{ classroom?: { name?: string } }> | undefined)?.[0]?.classroom?.name) ?? null),
    }));
}

export async function listCareChildren(): Promise<CareChildOption[]> {
  const response = await http.get('/children');
  return normalizeChildren(response.data);
}

export async function getChildCareOverview(childId: string): Promise<CareOverview> {
  const response = await http.get<CareOverview>(`/care/children/${childId}/overview`);
  return response.data;
}
