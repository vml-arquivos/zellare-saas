import { PrismaClient, RoleLevel, RoleType } from '@prisma/client';
import { JourneyAccessService } from '../../dist/src/journey/journey-access.service.js';
import { JourneyService } from '../../dist/src/journey/journey.service.js';

const prisma = new PrismaClient();
const ids = {
  tenant: 'journey-verification-org',
  unit: 'journey-verification-unit',
  classroom: 'journey-verification-class',
  prospectA: 'journey-verification-prospect-a',
  prospectB: 'journey-verification-prospect-b',
};
const actor = {
  sub: 'journey-verification-operator',
  email: 'journey-verification@example.invalid',
  mantenedoraId: ids.tenant,
  unitId: ids.unit,
  roles: [{ roleId: 'journey-verification-role', level: RoleLevel.UNIDADE, type: RoleType.UNIDADE_ADMINISTRATIVO, unitScopes: [ids.unit] }],
};
const audit = { logCreate: async () => undefined, logUpdate: async () => undefined };

async function cleanup() {
  await prisma.domainOutboxEvent.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeyProspect.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeySeatOffer.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.journeyWaitlistPolicyVersion.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.tenantFeatureFlag.deleteMany({ where: { mantenedoraId: ids.tenant } });
  await prisma.classroom.deleteMany({ where: { id: ids.classroom } });
  await prisma.unit.deleteMany({ where: { id: ids.unit } });
  await prisma.mantenedora.deleteMany({ where: { id: ids.tenant } });
}

async function main() {
  await cleanup();
  await prisma.mantenedora.create({ data: { id: ids.tenant, name: 'Organização de Verificação Sintética', email: 'journey-verification-org@example.invalid', cnpj: '00.000.000/0001-01' } });
  await prisma.unit.create({ data: { id: ids.unit, mantenedoraId: ids.tenant, name: 'Unidade de Verificação Sintética', code: 'JOURNEY-VERIFY', capacity: 1 } });
  await prisma.classroom.create({ data: { id: ids.classroom, unitId: ids.unit, name: 'Turma de Verificação', code: 'JOURNEY-VERIFY-01', capacity: 1, ageGroupMin: 0, ageGroupMax: 48 } });
  await prisma.tenantFeatureFlag.create({ data: { mantenedoraId: ids.tenant, flagKey: 'journey_admissions_v1', enabled: true, config: {} } });
  await prisma.journeyProspect.createMany({ data: [
    { id: ids.prospectA, mantenedoraId: ids.tenant, unitId: ids.unit, responsibleName: 'Responsável Sintético A', childName: 'Criança Sintética A', source: 'verification', ageGroupMinMonths: 0, ageGroupMaxMonths: 48, period: 'Integral', consentCapture: true, consentContact: true, createdBy: actor.sub, idempotencyKey: 'verification-prospect-a' },
    { id: ids.prospectB, mantenedoraId: ids.tenant, unitId: ids.unit, responsibleName: 'Responsável Sintético B', childName: 'Criança Sintética B', source: 'verification', ageGroupMinMonths: 0, ageGroupMaxMonths: 48, period: 'Integral', consentCapture: true, consentContact: true, createdBy: actor.sub, idempotencyKey: 'verification-prospect-b' },
  ] });
  const access = new JourneyAccessService(prisma);
  const service = new JourneyService(prisma, access, audit);
  const base = { unitId: ids.unit, classroomId: ids.classroom, reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
  const concurrent = await Promise.allSettled([
    service.createOffer({ ...base, prospectId: ids.prospectA, idempotencyKey: 'verification-offer-a' }, actor),
    service.createOffer({ ...base, prospectId: ids.prospectB, idempotencyKey: 'verification-offer-b' }, actor),
  ]);
  const fulfilled = concurrent.filter((item) => item.status === 'fulfilled');
  const rejected = concurrent.filter((item) => item.status === 'rejected');
  if (fulfilled.length !== 1 || rejected.length !== 1 || rejected[0].reason?.constructor?.name !== 'ConflictException') {
    throw new Error(`concorrência inválida: fulfilled=${fulfilled.length} rejected=${rejected.length} reason=${rejected[0]?.reason?.message ?? 'none'}`);
  }
  const successfulDto = fulfilled[0].status === 'fulfilled' && fulfilled[0].value.prospectId === ids.prospectA
    ? { ...base, prospectId: ids.prospectA, idempotencyKey: 'verification-offer-a' }
    : { ...base, prospectId: ids.prospectB, idempotencyKey: 'verification-offer-b' };
  const replay = await service.createOffer(successfulDto, actor);
  const offerCount = await prisma.journeySeatOffer.count({ where: { mantenedoraId: ids.tenant } });
  const enrollmentCount = await prisma.enrollment.count({ where: { classroomId: ids.classroom } });
  const childCount = await prisma.child.count({ where: { mantenedoraId: ids.tenant } });
  const draftCount = await prisma.journeyEnrollmentDraft.count({ where: { mantenedoraId: ids.tenant } });
  if (offerCount !== 1 || enrollmentCount !== 0 || childCount !== 0 || draftCount !== 0) throw new Error(`invariantes falharam: offers=${offerCount} enrollments=${enrollmentCount} children=${childCount} drafts=${draftCount}`);
  if (replay.id !== fulfilled[0].value.id) throw new Error('retry idempotente não retornou a mesma oferta');
  console.log(JSON.stringify({ concurrency: '1 success / 1 ConflictException', offerCount, enrollmentCount, childCount, draftCount, replaySameOffer: true }));
}

try {
  await main();
} finally {
  await cleanup();
  await prisma.$disconnect();
}
