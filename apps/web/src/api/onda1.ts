/* eslint-disable @typescript-eslint/no-explicit-any */
import http from './http';

export type Onda1PageInfo = { hasMore: boolean; nextCursor: string | null };

export type Child360Response = {
  child: { id: string; firstName?: string; lastName?: string; photoUrl?: string | null };
  period: { startDate: string; endDate: string };
  timeline: { items: any[]; pageInfo: Onda1PageInfo };
  evidence: { items: any[]; total: number; pageInfo: Onda1PageInfo };
  quality: { coverageDays: number; bySource: Array<{ sourceType: string; count: number }>; byReviewStatus: Array<{ reviewStatus: string; count: number }> };
  goals: any[];
  supports: any[];
  planningLinks: any[];
  publications: any[];
  familyContributions: any[];
  operationalUrgency: any[];
  longitudinalSignals: any[];
  governance: { evidenceOnly: boolean; diagnosticInference: boolean; humanReviewRequired: boolean; sourceTraceability: boolean; internalOnly: boolean };
};

export type ReviewQueueResponse = { items: any[]; pageInfo: Onda1PageInfo };
export type FamilyCircleResponse = { child: any; publications: any[]; conversations: any[]; contributions: any[]; pageInfo: Onda1PageInfo; governance: any };

export async function getChild360(childId: string, params?: Record<string, string | number | undefined>) {
  const { data } = await http.get<Child360Response>(`/children/${childId}/evidence-loop`, { params });
  return data;
}

export async function getReviewQueue(params?: Record<string, string | number | undefined>) {
  const { data } = await http.get<ReviewQueueResponse>('/evidence/review-queue', { params });
  return data;
}

export async function updateReviewTask(taskId: string, body: { status: string; expectedVersion: number; decisionNote?: string; actionTaken?: string }) {
  const { data } = await http.patch(`/evidence/review-tasks/${taskId}`, body);
  return data;
}

export async function getFamilyCircle(childId: string, params?: Record<string, string | number | undefined>) {
  const { data } = await http.get<FamilyCircleResponse>(`/children/${childId}/family-circle`, { params });
  return data;
}

export async function getFamilyChildren() {
  const { data } = await http.get('/family/children');
  return Array.isArray(data) ? data : data?.items ?? data?.children ?? [];
}

export async function sendFamilyMessage(conversationId: string, body: string, clientMutationId: string) {
  const { data } = await http.post(`/family-conversations/${conversationId}/messages`, { body, clientMutationId });
  return data;
}
