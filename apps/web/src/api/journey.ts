import http from "./http";

export type JourneyStage =
  | "NOVO"
  | "CONTATADO"
  | "VISITA_AGENDADA"
  | "VISITA_REALIZADA"
  | "LISTA_ESPERA"
  | "VAGA_OFERECIDA"
  | "ACEITO"
  | "PERDIDO"
  | "ARQUIVADO";

export interface JourneyUnit {
  id: string;
  name: string;
  code: string;
  capacity: number;
}

export interface JourneyProspect {
  id: string;
  unitId: string;
  responsibleName: string;
  childName: string;
  email?: string | null;
  phone?: string | null;
  source: string;
  ageGroupMinMonths: number;
  ageGroupMaxMonths: number;
  period: string;
  desiredDate?: string | null;
  consentCapture: boolean;
  consentContact: boolean;
  stage: JourneyStage;
  version: number;
  createdAt: string;
  updatedAt: string;
  privacy?: {
    status: "ACTIVE" | "RETAINED" | "ERASURE_REQUESTED" | "ERASED";
    retentionUntil: string | null;
    captureLegalBasis?: string | null;
    contactLegalBasis?: string | null;
    consentPolicyVersion?: string | null;
    consentCapturedAt?: string | null;
    contactConsentAt?: string | null;
  };
  _count?: {
    visits: number;
    activities: number;
    tasks: number;
    offers: number;
  };
}

export interface JourneyVisit {
  id: string;
  unitId: string;
  prospectId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  assignedTo?: string | null;
  prospect?: Pick<
    JourneyProspect,
    "id" | "responsibleName" | "childName" | "stage"
  >;
}

export interface JourneyWaitlistEntry {
  id: string;
  priorityScore: number;
  explanation: Record<string, unknown>;
  status: string;
  prospect: Pick<
    JourneyProspect,
    "id" | "responsibleName" | "childName" | "period" | "desiredDate" | "stage"
  > & { ageGroupMinMonths: number; ageGroupMaxMonths: number };
  policy: {
    id: string;
    version: number;
    programKey: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
  };
}

export interface JourneyOffer {
  id: string;
  unitId: string;
  prospectId: string;
  classroomId: string;
  status: string;
  reservationExpiresAt: string;
  classroom?: { id: string; name: string; code: string; capacity: number };
  prospect?: Pick<
    JourneyProspect,
    "id" | "responsibleName" | "childName" | "stage"
  >;
}

export interface JourneyDashboard {
  generatedAt: string;
  freshnessAt: string;
  period: { from: string | null; to: string; timezone: string };
  source: string;
  scope: { mantenedoraId: string; unitIds: string[] };
  totals: {
    prospects: number;
    upcomingVisits: number;
    waiting: number;
    activeOffers: number;
  };
  stages: Record<JourneyStage, number>;
  capacity: Array<{
    classroomId: string;
    unitId: string;
    name: string;
    code: string;
    capacity: number;
    activeEnrollments: number;
    availableBeforeJourneyReservations: number;
  }>;
  error: string | null;
  governance: { diagnosticInference: false; humanReviewRequired: true };
}

export interface CreateProspectInput {
  responsibleName: string;
  childName: string;
  email?: string;
  phone?: string;
  declaredIdentityType?: string;
  declaredIdentity?: string;
  source: string;
  unitId: string;
  ageGroupMinMonths: number;
  ageGroupMaxMonths: number;
  period: string;
  desiredDate?: string;
  consentCapture: boolean;
  consentContact: boolean;
  captureLegalBasis?: "CONSENT";
  contactLegalBasis?: "CONSENT";
  consentPolicyVersion?: string;
  retentionUntil?: string;
  idempotencyKey: string;
}

function key(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${value}`;
}

export const journeyIdempotencyKey = key;

export async function getJourneyUnits() {
  const response = await http.get<JourneyUnit[]>("/journey/units");
  return response.data;
}

export async function getJourneyDashboard(unitId?: string) {
  const response = await http.get<JourneyDashboard>("/journey/dashboard", {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function getJourneyProspects(params?: {
  unitId?: string;
  stage?: JourneyStage;
  limit?: number;
}) {
  const response = await http.get<JourneyProspect[]>("/journey/prospects", {
    params,
  });
  return response.data;
}

export async function createJourneyProspect(input: CreateProspectInput) {
  const response = await http.post("/journey/prospects", input);
  return response.data as {
    prospect: JourneyProspect;
    possibleDuplicates: Array<
      Pick<
        JourneyProspect,
        "id" | "unitId" | "responsibleName" | "childName" | "stage"
      >
    >;
  };
}

export async function getJourneyVisits(unitId?: string) {
  const response = await http.get<JourneyVisit[]>("/journey/visits", {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function getJourneyWaitlist(unitId?: string) {
  const response = await http.get<JourneyWaitlistEntry[]>("/journey/waitlist", {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function getJourneyOffers(unitId?: string) {
  const response = await http.get<JourneyOffer[]>("/journey/offers", {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export interface JourneyPolicy {
  id: string;
  unitId: string;
  programKey: string;
  ageGroupMinMonths: number;
  ageGroupMaxMonths: number;
  period: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: "RASCUNHO" | "PUBLICADA" | "ARQUIVADA";
  priorityDefinition: Record<string, unknown>;
  createdBy: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  publishedBy?: string | null;
  publishedAt?: string | null;
}

export interface JourneyDuplicateReview {
  id: string;
  primaryProspectId: string;
  duplicateProspectId: string;
  matchReasons: string[];
  status: "PENDENTE" | "CONFIRMADA" | "REJEITADA" | "DESFEITA";
  primary?: Pick<JourneyProspect, "id" | "unitId" | "responsibleName" | "childName" | "stage">;
  duplicate?: Pick<JourneyProspect, "id" | "unitId" | "responsibleName" | "childName" | "stage">;
}

export async function changeJourneyStage(id: string, input: { toStage: JourneyStage; reason?: string; idempotencyKey: string }) {
  const response = await http.patch<JourneyProspect>(`/journey/prospects/${id}/stage`, input);
  return response.data;
}

export async function createJourneyVisit(input: {
  prospectId: string; unitId: string; startsAt: string; endsAt: string; assignedTo?: string; notes?: string; idempotencyKey: string;
}) {
  const response = await http.post<JourneyVisit>("/journey/visits", input);
  return response.data;
}

export async function rescheduleJourneyVisit(id: string, input: { startsAt: string; endsAt: string; note?: string; idempotencyKey: string }) {
  const response = await http.patch<JourneyVisit>(`/journey/visits/${id}/reschedule`, input);
  return response.data;
}

async function journeyVisitAction(id: string, action: "cancel" | "confirm" | "absence" | "follow-up", input: { note?: string; idempotencyKey: string }) {
  const response = await http.patch<JourneyVisit>(`/journey/visits/${id}/${action}`, input);
  return response.data;
}

export const cancelJourneyVisit = (id: string, input: { note?: string; idempotencyKey: string }) => journeyVisitAction(id, "cancel", input);
export const confirmJourneyVisit = (id: string, input: { note?: string; idempotencyKey: string }) => journeyVisitAction(id, "confirm", input);
export const markJourneyVisitAbsence = (id: string, input: { note?: string; idempotencyKey: string }) => journeyVisitAction(id, "absence", input);
export const registerJourneyVisitFollowUp = (id: string, input: { note?: string; idempotencyKey: string }) => journeyVisitAction(id, "follow-up", input);

export async function getJourneyPolicies(unitId?: string) {
  const response = await http.get<JourneyPolicy[]>("/journey/waitlist/policies", { params: unitId ? { unitId } : undefined });
  return response.data;
}

export async function createJourneyPolicy(input: {
  unitId: string; programKey: string; ageGroupMinMonths: number; ageGroupMaxMonths: number; period: string; version: number; effectiveFrom: string; effectiveTo?: string; priorityDefinition: Record<string, unknown>; idempotencyKey: string;
}) {
  const response = await http.post<JourneyPolicy>("/journey/waitlist/policies", input);
  return response.data;
}

export async function reviewJourneyPolicy(id: string) {
  const response = await http.patch<JourneyPolicy>(`/journey/waitlist/policies/${id}/review`);
  return response.data;
}

export async function publishJourneyPolicy(id: string, idempotencyKey: string) {
  const response = await http.patch<JourneyPolicy>(`/journey/waitlist/policies/${id}/publish`, { idempotencyKey });
  return response.data;
}

export async function joinJourneyWaitlist(input: { unitId: string; prospectId: string; policyId: string; idempotencyKey: string }) {
  const response = await http.post<JourneyWaitlistEntry>("/journey/waitlist", input);
  return response.data;
}

export async function createJourneyOffer(input: {
  unitId: string; prospectId: string; classroomId: string; waitlistEntryId?: string; reservationExpiresAt: string; overrideReason?: string; idempotencyKey: string;
}) {
  const response = await http.post<JourneyOffer>("/journey/offers", input);
  return response.data;
}

export async function decideJourneyOffer(id: string, input: { decision: "accept" | "reject"; reason?: string; idempotencyKey: string }) {
  const response = await http.patch<{ offer: JourneyOffer; draft: { id: string; missingFields: unknown; status: string } | null }>(`/journey/offers/${id}/decision`, input);
  return response.data;
}

export async function getJourneyDuplicateReviews() {
  const response = await http.get<JourneyDuplicateReview[]>("/journey/duplicates");
  return response.data;
}

export async function reviewJourneyDuplicate(id: string, decision: "confirm" | "reject") {
  const response = await http.patch<JourneyDuplicateReview>(`/journey/duplicates/${id}/review`, { decision, idempotencyKey: journeyIdempotencyKey("duplicate-review") });
  return response.data;
}

export async function undoJourneyDuplicate(id: string) {
  const response = await http.post<JourneyDuplicateReview>(`/journey/duplicates/${id}/undo`, { idempotencyKey: journeyIdempotencyKey("duplicate-undo") });
  return response.data;
}

export async function createJourneyActivity(id: string, input: { type: "INTERACAO" | "NOTA" | "FOLLOW_UP"; title: string; note?: string; nextAction?: string; occurredAt?: string; idempotencyKey: string }) {
  const response = await http.post(`/journey/prospects/${id}/activities`, input);
  return response.data;
}

export async function createJourneyTask(id: string, input: { title: string; dueAt?: string; assignedTo?: string; idempotencyKey: string }) {
  const response = await http.post(`/journey/prospects/${id}/tasks`, input);
  return response.data;
}

export async function completeJourneyTask(id: string) {
  const response = await http.patch(`/journey/tasks/${id}/complete`);
  return response.data;
}

export async function setJourneyProspectRetention(id: string, input: { retentionUntil: string; reason: string; idempotencyKey: string }) {
  const response = await http.patch<JourneyProspect>(`/journey/prospects/${id}/privacy/retention`, input);
  return response.data;
}

export async function revokeJourneyProspectContact(id: string, input: { reason: string; idempotencyKey: string }) {
  const response = await http.patch<JourneyProspect>(`/journey/prospects/${id}/privacy/contact/revoke`, input);
  return response.data;
}

export async function eraseJourneyProspect(id: string, input: { reason: string; idempotencyKey: string }) {
  const response = await http.patch<{ id: string; status: string; erasedAt?: string }>(`/journey/prospects/${id}/privacy/erase`, input);
  return response.data;
}
