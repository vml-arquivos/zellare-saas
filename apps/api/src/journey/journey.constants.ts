export const JOURNEY_FEATURE_FLAGS = {
  admissionsV1: "journey_admissions_v1",
} as const;

export type JourneyFeatureFlagKey =
  (typeof JOURNEY_FEATURE_FLAGS)[keyof typeof JOURNEY_FEATURE_FLAGS];

export const JOURNEY_CAPABILITIES = {
  read: "journey.read",
  manage: "journey.manage",
  prospectRead: "journey.prospect.read",
  prospectManage: "journey.prospect.manage",
  visitRead: "journey.visit.read",
  visitManage: "journey.visit.manage",
  waitlistRead: "journey.waitlist.read",
  manageWaitlist: "journey.waitlist.manage",
  offerRead: "journey.offer.read",
  offerSeat: "journey.offer.create",
  acceptOffer: "journey.offer.accept",
  overrideCapacity: "journey.offer.override",
  reviewMerge: "journey.merge.review",
  privacyManage: "journey.privacy.manage",
} as const;

export type JourneyCapability =
  (typeof JOURNEY_CAPABILITIES)[keyof typeof JOURNEY_CAPABILITIES];

export const JOURNEY_GOVERNANCE = {
  diagnosticInference: false as const,
  humanReviewRequired: true as const,
  contactHashVersion: "hmac-sha256-v1" as const,
  contactCipherVersion: "aes-256-gcm-v1" as const,
  prospectPrivacyPolicyVersion: "journey-privacy-v1" as const,
  defaultRetentionDays: 180,
};

export const JOURNEY_ALLOWED_PROSPECT_FIELDS = [
  "responsibleName",
  "childName",
  "email",
  "phone",
  "declaredIdentityType",
  "declaredIdentity",
  "source",
  "unitId",
  "ageGroupMinMonths",
  "ageGroupMaxMonths",
  "period",
  "desiredDate",
  "consentCapture",
  "consentContact",
  "captureLegalBasis",
  "contactLegalBasis",
  "consentPolicyVersion",
  "retentionUntil",
] as const;

export const JOURNEY_FORBIDDEN_TERMS = [
  "health",
  "saude",
  "medical",
  "clin",
  "psych",
  "psic",
  "pedagog",
  "behavior",
  "comport",
  "deficien",
  "disab",
  "rdic",
  "rdx",
  "inadimpl",
  "finance",
  "pagamento",
  "diagnos",
  "laudo",
] as const;

export const JOURNEY_DEFAULT_FLAGS: Record<JourneyFeatureFlagKey, false> = {
  [JOURNEY_FEATURE_FLAGS.admissionsV1]: false,
};

export const JOURNEY_STAGE_LABELS = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  VISITA_AGENDADA: "Visita agendada",
  VISITA_REALIZADA: "Visita realizada",
  LISTA_ESPERA: "Lista de espera",
  VAGA_OFERECIDA: "Vaga oferecida",
  ACEITO: "Aceito",
  PERDIDO: "Perdido",
  ARQUIVADO: "Arquivado",
} as const;

export const JOURNEY_ALLOWED_STAGE_TRANSITIONS = {
  NOVO: [
    "CONTATADO",
    "VISITA_AGENDADA",
    "LISTA_ESPERA",
    "VAGA_OFERECIDA",
    "PERDIDO",
    "ARQUIVADO",
  ],
  CONTATADO: [
    "VISITA_AGENDADA",
    "VISITA_REALIZADA",
    "LISTA_ESPERA",
    "VAGA_OFERECIDA",
    "PERDIDO",
    "ARQUIVADO",
  ],
  VISITA_AGENDADA: [
    "VISITA_REALIZADA",
    "LISTA_ESPERA",
    "VAGA_OFERECIDA",
    "PERDIDO",
    "ARQUIVADO",
  ],
  VISITA_REALIZADA: ["LISTA_ESPERA", "VAGA_OFERECIDA", "PERDIDO", "ARQUIVADO"],
  LISTA_ESPERA: ["VAGA_OFERECIDA", "PERDIDO", "ARQUIVADO"],
  VAGA_OFERECIDA: ["ACEITO", "LISTA_ESPERA", "PERDIDO", "ARQUIVADO"],
  ACEITO: ["ARQUIVADO"],
  PERDIDO: ["ARQUIVADO"],
  ARQUIVADO: [],
} as const;

export type JourneyStageTransition = {
  from: keyof typeof JOURNEY_ALLOWED_STAGE_TRANSITIONS;
  to: string;
};
