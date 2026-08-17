import http from './http';

export interface FamilyChild {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  unitId: string;
  relationship?: string;
  isPrimary?: boolean;
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
  privacy: { familyDataFiltered: boolean; healthDataVisible: boolean };
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

export async function listFamilyChildren() {
  const response = await http.get<FamilyChild[]>('/family/children');
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
