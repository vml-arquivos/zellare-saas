import http from './http';

export type RdicInstitutionType = 'PUBLICA' | 'PRIVADA' | 'REDE_PUBLICA' | 'OUTRA';
export type RdicProfileStatus = 'RASCUNHO' | 'ATIVO' | 'ARQUIVADO';

export interface RdicDocumentProfile {
  id: string;
  mantenedoraId?: string | null;
  code: string;
  name: string;
  documentLabel: string;
  institutionType: RdicInstitutionType;
  authorityName?: string | null;
  authorityReference?: string | null;
  curriculumReference?: string | null;
  sourceUrl?: string | null;
  version: number;
  status: RdicProfileStatus;
  isCurated: boolean;
  periodicity: string;
  requiredFields: unknown;
  signaturePolicy: Record<string, unknown>;
  familyPolicy: Record<string, unknown>;
  archivePolicy: Record<string, unknown>;
  templateSchema: Record<string, unknown>;
}

export interface CreateRdicProfileInput {
  code: string;
  name: string;
  documentLabel: string;
  institutionType: RdicInstitutionType;
  periodicity: string;
  authorityName?: string;
  authorityReference?: string;
  curriculumReference?: string;
  sourceUrl?: string;
  requiredFields?: string[];
  signaturePolicy?: Record<string, unknown>;
  familyPolicy?: Record<string, unknown>;
  archivePolicy?: Record<string, unknown>;
  templateSchema?: Record<string, unknown>;
}

export async function listRdicProfiles(): Promise<RdicDocumentProfile[]> {
  const response = await http.get<RdicDocumentProfile[]>('/rdic/profiles');
  return Array.isArray(response.data) ? response.data : [];
}

export async function createRdicProfile(input: CreateRdicProfileInput): Promise<RdicDocumentProfile> {
  const response = await http.post<RdicDocumentProfile>('/rdic/profiles', input);
  return response.data;
}

export async function cloneRdicProfile(profileId: string): Promise<RdicDocumentProfile> {
  const response = await http.post<RdicDocumentProfile>(`/rdic/profiles/${profileId}/clone`);
  return response.data;
}

export async function setDefaultRdicProfile(profileId: string, unitId?: string): Promise<{ profileId: string; profileVersion: number; scope: string; unitId?: string }> {
  const response = await http.post('/rdic/profiles/default', { profileId, unitId: unitId || undefined });
  return response.data;
}
