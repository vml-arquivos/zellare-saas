import bcrypt from 'bcrypt';
import { PrismaClient, JourneyStage, JourneyVisitStatus, JourneyVisitEventType, JourneyWaitlistPolicyStatus, JourneyWaitlistEntryStatus, JourneyOfferStatus, RoleLevel, RoleType, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();
const password = 'JourneyLocal!2026';
const ids = {
  tenant: 'journey-e2e-org',
  unit: 'journey-e2e-unit',
  classroom: 'journey-e2e-class',
  role: 'journey-e2e-role',
  user: 'journey-e2e-user',
  userRole: 'journey-e2e-user-role',
  unitScope: 'journey-e2e-unit-scope',
  prospectA: 'journey-e2e-prospect-a',
  prospectB: 'journey-e2e-prospect-b',
  policy: 'journey-e2e-policy',
  waitlist: 'journey-e2e-waitlist',
  visit: 'journey-e2e-visit',
  visitEvent: 'journey-e2e-visit-event',
  offer: 'journey-e2e-offer',
  stageA: 'journey-e2e-stage-a',
  stageB: 'journey-e2e-stage-b',
};

async function cleanup() {
  await prisma.domainOutboxEvent.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeyProspect.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeySeatOffer.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeyWaitlistEntry.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeyVisit.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeyWaitlistPolicyVersion.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.tenantFeatureFlag.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.userRoleUnitScope.deleteMany({ where: { id: ids.unitScope } });
  await prisma.userRole.deleteMany({ where: { id: ids.userRole } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
  await prisma.role.deleteMany({ where: { id: ids.role } });
  await prisma.classroom.deleteMany({ where: { id: ids.classroom } });
  await prisma.unit.deleteMany({ where: { id: ids.unit } });
  await prisma.mantenedora.deleteMany({ where: { id: ids.tenant } });
}

async function setup() {
  await cleanup();
  await prisma.mantenedora.create({ data: { id: ids.tenant, name: 'Organização E2E Sintética', email: 'journey-e2e-org@example.invalid', cnpj: '00.000.000/0001-02' } });
  await prisma.unit.create({ data: { id: ids.unit, mantenedoraId: ids.tenant, name: 'Unidade E2E Sintética', code: 'JOURNEY-E2E', capacity: 30 } });
  await prisma.classroom.create({ data: { id: ids.classroom, unitId: ids.unit, name: 'Turma E2E Sintética', code: 'JOURNEY-E2E-01', capacity: 10, ageGroupMin: 0, ageGroupMax: 48 } });
  await prisma.tenantFeatureFlag.create({ data: { mantenedoraId: ids.tenant, flagKey: 'journey_admissions_v1', enabled: true, config: {} } });
  await prisma.role.create({ data: { id: ids.role, mantenedoraId: ids.tenant, name: 'Administrativo E2E', type: RoleType.UNIDADE_ADMINISTRATIVO, level: RoleLevel.UNIDADE } });
  await prisma.user.create({ data: { id: ids.user, mantenedoraId: ids.tenant, unitId: ids.unit, email: 'journey-e2e@example.invalid', password: await bcrypt.hash(password, 4), firstName: 'Operador', lastName: 'Sintético', status: UserStatus.ATIVO, emailVerified: true } });
  await prisma.userRole.create({ data: { id: ids.userRole, userId: ids.user, roleId: ids.role, scopeLevel: RoleLevel.UNIDADE } });
  await prisma.userRoleUnitScope.create({ data: { id: ids.unitScope, userRoleId: ids.userRole, unitId: ids.unit } });
  await prisma.journeyProspect.createMany({ data: [
    { id: ids.prospectA, mantenedoraId: ids.tenant, unitId: ids.unit, responsibleName: 'Ana Responsável', childName: 'Lia Prospectiva', email: 'ana.prospect@example.invalid', phone: '+55 61 99999-0001', source: 'Site', ageGroupMinMonths: 24, ageGroupMaxMonths: 36, period: 'Integral', desiredDate: new Date('2026-09-01T12:00:00Z'), consentCapture: true, consentContact: true, stage: JourneyStage.VAGA_OFERECIDA, createdBy: ids.user, idempotencyKey: 'journey-e2e-prospect-a' },
    { id: ids.prospectB, mantenedoraId: ids.tenant, unitId: ids.unit, responsibleName: 'Bruno Responsável', childName: 'Noa Prospectiva', email: 'bruno.prospect@example.invalid', phone: '+55 61 99999-0002', source: 'Indicação', ageGroupMinMonths: 36, ageGroupMaxMonths: 48, period: 'Parcial', desiredDate: new Date('2026-10-01T12:00:00Z'), consentCapture: true, consentContact: true, stage: JourneyStage.LISTA_ESPERA, createdBy: ids.user, idempotencyKey: 'journey-e2e-prospect-b' },
  ] });
  await prisma.journeyProspectStageEvent.createMany({ data: [
    { id: ids.stageA, mantenedoraId: ids.tenant, unitId: ids.unit, prospectId: ids.prospectA, fromStage: JourneyStage.NOVO, toStage: JourneyStage.VAGA_OFERECIDA, actorUserId: ids.user, idempotencyKey: 'journey-e2e-stage-a' },
    { id: ids.stageB, mantenedoraId: ids.tenant, unitId: ids.unit, prospectId: ids.prospectB, fromStage: JourneyStage.NOVO, toStage: JourneyStage.LISTA_ESPERA, actorUserId: ids.user, idempotencyKey: 'journey-e2e-stage-b' },
  ] });
  await prisma.journeyWaitlistPolicyVersion.create({ data: { id: ids.policy, mantenedoraId: ids.tenant, unitId: ids.unit, programKey: 'educacao-infantil', ageGroupMinMonths: 0, ageGroupMaxMonths: 48, period: 'Parcial', version: 1, effectiveFrom: new Date('2026-01-01T00:00:00Z'), status: JourneyWaitlistPolicyStatus.PUBLICADA, priorityDefinition: { rules: [{ field: 'desiredDate', direction: 'asc' }] }, createdBy: ids.user, reviewedBy: 'reviewer-synthetic', publishedBy: 'publisher-synthetic', publishedAt: new Date('2026-01-02T00:00:00Z'), idempotencyKey: 'journey-e2e-policy-v1' } });
  await prisma.journeyWaitlistEntry.create({ data: { id: ids.waitlist, mantenedoraId: ids.tenant, unitId: ids.unit, prospectId: ids.prospectB, policyId: ids.policy, desiredDate: new Date('2026-10-01T12:00:00Z'), priorityScore: 10, explanation: { reasons: ['data desejada'] }, status: JourneyWaitlistEntryStatus.AGUARDANDO, createdBy: ids.user, idempotencyKey: 'journey-e2e-waitlist-b' } });
  await prisma.journeyVisit.create({ data: { id: ids.visit, mantenedoraId: ids.tenant, unitId: ids.unit, prospectId: ids.prospectA, startsAt: new Date('2026-08-25T14:00:00Z'), endsAt: new Date('2026-08-25T14:30:00Z'), status: JourneyVisitStatus.AGENDADA, assignedTo: ids.user, createdBy: ids.user, idempotencyKey: 'journey-e2e-visit-a' } });
  await prisma.journeyVisitEvent.create({ data: { id: ids.visitEvent, mantenedoraId: ids.tenant, unitId: ids.unit, visitId: ids.visit, type: JourneyVisitEventType.CRIADA, startsAt: new Date('2026-08-25T14:00:00Z'), endsAt: new Date('2026-08-25T14:30:00Z'), actorUserId: ids.user, idempotencyKey: 'journey-e2e-visit-event-a' } });
  await prisma.journeySeatOffer.create({ data: { id: ids.offer, mantenedoraId: ids.tenant, unitId: ids.unit, prospectId: ids.prospectA, classroomId: ids.classroom, status: JourneyOfferStatus.OFERTADA, reservationExpiresAt: new Date('2026-08-30T23:59:59Z'), createdBy: ids.user, idempotencyKey: 'journey-e2e-offer-a' } });
  console.log(JSON.stringify({ status: 'setup', email: 'journey-e2e@example.invalid', password, tenant: ids.tenant, unit: ids.unit }));
}

try {
  if (process.argv[2] === 'cleanup') await cleanup();
  else await setup();
} finally {
  await prisma.$disconnect();
}
