export const JOURNEY_FEATURE_FLAGS = {
  admissionsV1: "journey_admissions_v1",
} as const;

export type JourneyFeatureFlagKey =
  (typeof JOURNEY_FEATURE_FLAGS)[keyof typeof JOURNEY_FEATURE_FLAGS];

export const JOURNEY_CAPABILITIES = {
  read: "journey.read",
  manage: "journey.manage",
  reviewMerge: "journey.merge.review",
  manageWaitlist: "journey.waitlist.manage",
  offerSeat: "journey.offer.create",
  acceptOffer: "journey.offer.accept",
  overrideCapacity: "journey.offer.override",
} as const;

export type JourneyCapability =
  (typeof JOURNEY_CAPABILITIES)[keyof typeof JOURNEY_CAPABILITIES];

export const JOURNEY_GOVERNANCE = {
  diagnosticInference: false as const,
  humanReviewRequired: true as const,
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
