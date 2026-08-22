import http from './http';

export interface FamilyPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface FamilyUnitSummary {
  id: string;
  name: string;
  code: string;
}

export interface FamilyEnrollmentSummary {
  id: string;
  enrollmentDate: string;
  classroom: { id: string; name: string; code: string; unitId: string };
}

export interface FamilyChild {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  unitId: string;
  unit?: FamilyUnitSummary;
  activeEnrollment?: FamilyEnrollmentSummary | null;
  relationship?: string;
  isPrimary?: boolean;
}

export interface FamilyChildrenQuery {
  unitId?: string;
  classroomId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'firstName' | 'lastName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FamilyChildrenResponse {
  items: FamilyChild[];
  pagination: FamilyPagination;
}

export interface FamilyGuardianCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  unit?: FamilyUnitSummary | null;
}

export interface FamilyGuardianCandidatesQuery {
  unitId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'firstName' | 'lastName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FamilyTimelineItem {
  id: string;
  kind: 'DIARIO' | 'POST_TURMA' | 'OBSERVACAO' | 'COMUNICACAO';
  date: string;
  title: string;
  body?: string | null;
  data: unknown;
}

export interface FamilyTimelineResponse {
  child: FamilyChild;
  from: string;
  to: string;
  privacy: { familyDataFiltered: boolean; healthDataVisible: boolean; developmentVisible?: boolean };
  items: FamilyTimelineItem[];
}

export interface FamilyMessage {
  id: string;
  childId: string;
  senderUserId: string;
  recipientUserId?: string | null;
  subject: string;
  body: string;
  status: 'ENVIADA' | 'LIDA' | 'RESPONDIDA' | 'ARQUIVADA';
  createdAt: string;
  readAt?: string | null;
}

export async function listFamilyChildren(params?: FamilyChildrenQuery): Promise<FamilyChildrenResponse> {
  const response = await http.get<FamilyChildrenResponse>('/family/children', { params });
  return response.data;
}

export async function listGuardianCandidates(params?: FamilyGuardianCandidatesQuery) {
  const response = await http.get<{ items: FamilyGuardianCandidate[]; pagination: FamilyPagination }>('/family/guardian-candidates', { params });
  return response.data;
}

export async function getFamilyTimeline(childId: string, params?: { from?: string; to?: string }) {
  const response = await http.get<FamilyTimelineResponse>(`/family/children/${childId}/timeline`, { params });
  return response.data;
}

export async function listFamilyMessages(childId?: string) {
  const response = await http.get<FamilyMessage[]>('/family/messages', { params: childId ? { childId } : undefined });
  return response.data;
}

export async function sendFamilyMessage(childId: string, payload: { subject: string; body: string; recipientUserId?: string }) {
  const response = await http.post<FamilyMessage>(`/family/children/${childId}/messages`, payload);
  return response.data;
}

export async function markFamilyMessageRead(messageId: string) {
  const response = await http.patch<FamilyMessage>(`/family/messages/${messageId}/read`);
  return response.data;
}

export interface FamilyGuardian {
  id: string;
  childId: string;
  userId: string;
  relationship: string;
  isPrimary: boolean;
  canViewTimeline: boolean;
  canViewDevelopment: boolean;
  canViewHealth: boolean;
  consentAt?: string | null;
  revokedAt?: string | null;
  legalBasis?: string;
  consentPolicyVersion?: string;
  retentionUntil?: string | null;
  revocationReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    status: string;
  };
  audit?: Array<{
    id: string;
    action: string;
    description?: string | null;
    occurredAt: string;
    actor?: { id: string; firstName: string; lastName: string; email: string } | null;
  }>;
}

export interface LinkFamilyGuardianPayload {
  userId: string;
  relationship: string;
  isPrimary?: boolean;
  canViewTimeline?: boolean;
  canViewDevelopment?: boolean;
  canViewHealth?: boolean;
  legalBasis?: 'CONSENT';
  consentPolicyVersion?: string;
  retentionUntil?: string;
}

export async function listFamilyGuardians(childId: string) {
  const response = await http.get<FamilyGuardian[]>(`/family/children/${childId}/guardians`);
  return response.data;
}

export async function linkFamilyGuardian(childId: string, payload: LinkFamilyGuardianPayload) {
  const response = await http.post<FamilyGuardian>(`/family/children/${childId}/guardians`, payload);
  return response.data;
}

export async function revokeFamilyGuardian(childId: string, guardianUserId: string, payload: { reason: string }) {
  const response = await http.delete<{ count: number }>(`/family/children/${childId}/guardians/${guardianUserId}`, { data: payload });
  return response.data;
}
