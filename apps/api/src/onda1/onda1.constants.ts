export const ONDA1_FEATURE_FLAGS = {
  evidenceLoopV1: 'evidence_loop_v1',
  reviewHubV1: 'review_hub_v1',
  familyCircleV1: 'family_circle_v1',
  familyTranslationV1: 'family_translation_v1',
} as const;

export type Onda1FeatureFlagKey = (typeof ONDA1_FEATURE_FLAGS)[keyof typeof ONDA1_FEATURE_FLAGS];

export const ONDA1_CAPABILITIES = {
  evidenceCapture: 'evidence.capture',
  evidenceReview: 'evidence.review',
  evidenceViewSensitive: 'evidence.view_sensitive',
  goalManage: 'goal.manage',
  familyPublish: 'family.publish',
  familyMessage: 'family.message',
  familyContribute: 'family.contribute',
  consentManage: 'consent.manage',
  operationsViewUrgency: 'operations.view_urgency',
  analyticsViewAggregate: 'analytics.view_aggregate',
} as const;

export type Onda1Capability = (typeof ONDA1_CAPABILITIES)[keyof typeof ONDA1_CAPABILITIES];
