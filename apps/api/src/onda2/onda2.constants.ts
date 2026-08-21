export const ONDA2_FEATURE_FLAGS = {
  pulseCommandCenterV1: 'pulse_command_center_v1',
  ratioEngineV1: 'ratio_engine_v1',
  staffingCoverageV1: 'staffing_coverage_v1',
  facilitiesServiceDeskV1: 'facilities_service_desk_v1',
  preventiveMaintenanceV1: 'preventive_maintenance_v1',
  complianceInspectionsV1: 'compliance_inspections_v1',
  operationalAiV1: 'operational_ai_v1',
} as const;

export type Onda2FeatureFlagKey = (typeof ONDA2_FEATURE_FLAGS)[keyof typeof ONDA2_FEATURE_FLAGS];

export const ONDA2_CAPABILITIES = {
  pulseReadNetwork: 'pulse.read.network',
  pulseReadUnit: 'pulse.read.unit',
  pulseReadRoom: 'pulse.read.room',
  presenceRecord: 'presence.record',
  presenceCorrect: 'presence.correct',
  staffingManage: 'staffing.manage',
  staffingPublish: 'staffing.publish',
  ratioPolicyRead: 'ratio.policy.read',
  ratioPolicyManage: 'ratio.policy.manage',
  ratioPolicyPublish: 'ratio.policy.publish',
  ratioBreachAcknowledge: 'ratio.breach.acknowledge',
  ratioBreachResolve: 'ratio.breach.resolve',
  facilityRequestCreate: 'facility.request.create',
  facilityRequestTriage: 'facility.request.triage',
  workorderRead: 'workorder.read',
  workorderAssign: 'workorder.assign',
  workorderExecute: 'workorder.execute',
  workorderValidate: 'workorder.validate',
  workorderReopen: 'workorder.reopen',
  assetRead: 'asset.read',
  assetManage: 'asset.manage',
  preventiveManage: 'preventive.manage',
  inspectionExecute: 'inspection.execute',
  inspectionManage: 'inspection.manage',
  correctiveVerify: 'corrective.verify',
  facilityCostRead: 'facility.cost.read',
  facilityProcurementDraft: 'facility.procurement.draft',
  operationalAiUse: 'operational.ai.use',
  operationalAiReview: 'operational.ai.review',
} as const;

export type Onda2Capability = (typeof ONDA2_CAPABILITIES)[keyof typeof ONDA2_CAPABILITIES];

export const ONDA2_FLAG_DEFAULTS: Record<Onda2FeatureFlagKey, false> = {
  [ONDA2_FEATURE_FLAGS.pulseCommandCenterV1]: false,
  [ONDA2_FEATURE_FLAGS.ratioEngineV1]: false,
  [ONDA2_FEATURE_FLAGS.staffingCoverageV1]: false,
  [ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1]: false,
  [ONDA2_FEATURE_FLAGS.preventiveMaintenanceV1]: false,
  [ONDA2_FEATURE_FLAGS.complianceInspectionsV1]: false,
  [ONDA2_FEATURE_FLAGS.operationalAiV1]: false,
};

export const ONDA2_GOVERNANCE = {
  diagnosticInference: false as const,
  humanReviewRequired: true as const,
};
