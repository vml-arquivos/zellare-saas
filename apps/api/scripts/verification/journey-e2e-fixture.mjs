import bcrypt from "bcrypt";
import {
  createCipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  PrismaClient,
  JourneyStage,
  JourneyVisitStatus,
  JourneyVisitEventType,
  JourneyWaitlistPolicyStatus,
  JourneyWaitlistEntryStatus,
  JourneyOfferStatus,
  RoleLevel,
  RoleType,
  UserStatus,
  Onda1LegalBasis,
  JourneyProspectPrivacyStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const password = process.env.JOURNEY_E2E_PASSWORD;
if (!password)
  throw new Error(
    "JOURNEY_E2E_PASSWORD é obrigatório somente para o fixture E2E local.",
  );

const hmacSecret =
  process.env.JOURNEY_CONTACT_HMAC_SECRET ?? process.env.JWT_SECRET;
const encryptionSecret =
  process.env.JOURNEY_CONTACT_ENCRYPTION_SECRET ?? process.env.JWT_SECRET;
if (
  !hmacSecret ||
  hmacSecret.length < 16 ||
  !encryptionSecret ||
  encryptionSecret.length < 16
) {
  throw new Error(
    "Segredos sintéticos Journey precisam ter pelo menos 16 caracteres.",
  );
}

const ids = {
  tenant: "journey-e2e-org",
  unit: "journey-e2e-unit",
  isolatedUnit: "journey-e2e-isolated-unit",
  isolatedClassroom: "journey-e2e-isolated-class",
  isolatedProspect: "journey-e2e-isolated-prospect",
  foreignTenant: "journey-e2e-foreign-org",
  foreignUnit: "journey-e2e-foreign-unit",
  foreignClassroom: "journey-e2e-foreign-class",
  foreignProspect: "journey-e2e-foreign-prospect",
  classroom: "journey-e2e-class",
  adminRole: "journey-e2e-admin-role",
  admissionsRole: "journey-e2e-admissions-role",
  directorRole: "journey-e2e-director-role",
  pedagogyRole: "journey-e2e-pedagogy-role",
  adminUser: "journey-e2e-admin-user",
  admissionsUser: "journey-e2e-admissions-user",
  directorUser: "journey-e2e-director-user",
  pedagogyUser: "journey-e2e-pedagogy-user",
  adminUserRole: "journey-e2e-admin-user-role",
  admissionsUserRole: "journey-e2e-admissions-user-role",
  directorUserRole: "journey-e2e-director-user-role",
  pedagogyUserRole: "journey-e2e-pedagogy-user-role",
  adminScope: "journey-e2e-admin-scope",
  admissionsScope: "journey-e2e-admissions-scope",
  directorScope: "journey-e2e-director-scope",
  pedagogyScope: "journey-e2e-pedagogy-scope",
  prospectA: "journey-e2e-prospect-a",
  prospectB: "journey-e2e-prospect-b",
  policy: "journey-e2e-policy",
  waitlist: "journey-e2e-waitlist",
  visit: "journey-e2e-visit",
  visitEvent: "journey-e2e-visit-event",
  offer: "journey-e2e-offer",
  stageA: "journey-e2e-stage-a",
  stageB: "journey-e2e-stage-b",
};

const tenantIds = [ids.tenant, ids.foreignTenant];
const unitIds = [ids.unit, ids.isolatedUnit, ids.foreignUnit];
const classroomIds = [
  ids.classroom,
  ids.isolatedClassroom,
  ids.foreignClassroom,
];

const roleIds = [
  ids.adminRole,
  ids.admissionsRole,
  ids.directorRole,
  ids.pedagogyRole,
];
const userIds = [
  ids.adminUser,
  ids.admissionsUser,
  ids.directorUser,
  ids.pedagogyUser,
];
const userRoleIds = [
  ids.adminUserRole,
  ids.admissionsUserRole,
  ids.directorUserRole,
  ids.pedagogyUserRole,
];
const scopeIds = [
  ids.adminScope,
  ids.admissionsScope,
  ids.directorScope,
  ids.pedagogyScope,
];

function hashContact(value) {
  if (!value) return null;
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  return `hmac-sha256-v1:${createHmac("sha256", hmacSecret).update(normalized).digest("hex")}`;
}

function encryptionKey() {
  return scryptSync(encryptionSecret, "zelare-journey-contact-v1", 32);
}

function encryptContact(value) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value.trim(), "utf8"),
    cipher.final(),
  ]);
  return `aes-256-gcm-v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

async function cleanup() {
  await prisma.domainOutboxEvent.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyProspectPrivacyEvent.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyProspectStageEvent.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyVisitEvent.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyEnrollmentDraft.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeySeatOffer.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyWaitlistEntry.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyVisit.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyActivity.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyTask.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyDuplicateReview.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyWaitlistPolicyVersion.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.journeyProspect.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.tenantFeatureFlag.deleteMany({
    where: { mantenedoraId: { in: tenantIds } },
  });
  await prisma.userRoleUnitScope.deleteMany({
    where: { id: { in: scopeIds } },
  });
  await prisma.userRole.deleteMany({ where: { id: { in: userRoleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  await prisma.classroom.deleteMany({ where: { id: { in: classroomIds } } });
  await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
  await prisma.mantenedora.deleteMany({ where: { id: { in: tenantIds } } });
}

async function createUserRole({
  roleId,
  userId,
  userRoleId,
  scopeId,
  email,
  firstName,
  type,
  level,
}) {
  await prisma.role.create({
    data: {
      id: roleId,
      mantenedoraId: ids.tenant,
      name: `${type} E2E Sintético`,
      type,
      level,
    },
  });
  await prisma.user.create({
    data: {
      id: userId,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      email,
      password: await bcrypt.hash(password, 4),
      firstName,
      lastName: "Sintético",
      status: UserStatus.ATIVO,
      emailVerified: true,
    },
  });
  await prisma.userRole.create({
    data: { id: userRoleId, userId, roleId, scopeLevel: level },
  });
  await prisma.userRoleUnitScope.create({
    data: { id: scopeId, userRoleId, unitId: ids.unit },
  });
}

async function setup() {
  await cleanup();
  await prisma.mantenedora.create({
    data: {
      id: ids.tenant,
      name: "Organização E2E Sintética",
      email: "journey-e2e-org@example.invalid",
      cnpj: "00.000.000/0001-02",
    },
  });
  await prisma.mantenedora.create({
    data: {
      id: ids.foreignTenant,
      name: "Organização Estrangeira E2E Sintética",
      email: "journey-e2e-foreign-org@example.invalid",
      cnpj: "00.000.000/0001-03",
    },
  });
  await prisma.unit.create({
    data: {
      id: ids.unit,
      mantenedoraId: ids.tenant,
      name: "Unidade E2E Sintética",
      code: "JOURNEY-E2E",
      capacity: 30,
    },
  });
  await prisma.classroom.create({
    data: {
      id: ids.classroom,
      unitId: ids.unit,
      name: "Turma E2E Sintética",
      code: "JOURNEY-E2E-01",
      capacity: 10,
      ageGroupMin: 0,
      ageGroupMax: 48,
    },
  });
  await prisma.unit.create({
    data: {
      id: ids.isolatedUnit,
      mantenedoraId: ids.tenant,
      name: "Unidade Fora do Escopo E2E",
      code: "JOURNEY-E2E-02",
      capacity: 10,
    },
  });
  await prisma.classroom.create({
    data: {
      id: ids.isolatedClassroom,
      unitId: ids.isolatedUnit,
      name: "Turma Fora do Escopo E2E",
      code: "JOURNEY-E2E-02-01",
      capacity: 10,
      ageGroupMin: 0,
      ageGroupMax: 48,
    },
  });
  await prisma.unit.create({
    data: {
      id: ids.foreignUnit,
      mantenedoraId: ids.foreignTenant,
      name: "Unidade Estrangeira E2E Sintética",
      code: "JOURNEY-X-01",
      capacity: 10,
    },
  });
  await prisma.classroom.create({
    data: {
      id: ids.foreignClassroom,
      unitId: ids.foreignUnit,
      name: "Turma Estrangeira E2E Sintética",
      code: "JOURNEY-X-01-01",
      capacity: 10,
      ageGroupMin: 0,
      ageGroupMax: 48,
    },
  });
  await prisma.tenantFeatureFlag.create({
    data: {
      mantenedoraId: ids.tenant,
      flagKey: "journey_admissions_v1",
      enabled: true,
      config: {},
    },
  });

  await createUserRole({
    roleId: ids.adminRole,
    userId: ids.adminUser,
    userRoleId: ids.adminUserRole,
    scopeId: ids.adminScope,
    email: "journey-admin@example.invalid",
    firstName: "Admin",
    type: RoleType.UNIDADE_ADMINISTRATIVO,
    level: RoleLevel.UNIDADE,
  });
  await createUserRole({
    roleId: ids.admissionsRole,
    userId: ids.admissionsUser,
    userRoleId: ids.admissionsUserRole,
    scopeId: ids.admissionsScope,
    email: "journey-admissions@example.invalid",
    firstName: "Admissions",
    type: RoleType.STAFF_CENTRAL_ADMISSOES,
    level: RoleLevel.STAFF_CENTRAL,
  });
  await createUserRole({
    roleId: ids.directorRole,
    userId: ids.directorUser,
    userRoleId: ids.directorUserRole,
    scopeId: ids.directorScope,
    email: "journey-director@example.invalid",
    firstName: "Diretor",
    type: RoleType.UNIDADE_DIRETOR,
    level: RoleLevel.UNIDADE,
  });
  await createUserRole({
    roleId: ids.pedagogyRole,
    userId: ids.pedagogyUser,
    userRoleId: ids.pedagogyUserRole,
    scopeId: ids.pedagogyScope,
    email: "journey-pedagogy@example.invalid",
    firstName: "Pedagogia",
    type: RoleType.UNIDADE_COORDENADOR_PEDAGOGICO,
    level: RoleLevel.UNIDADE,
  });

  const capturedAt = new Date("2026-08-22T12:00:00.000Z");
  const retentionUntil = new Date("2027-08-22T12:00:00.000Z");
  const contacts = {
    a: { email: "ana.prospect@example.invalid", phone: "+55 61 99999-0001" },
    b: { email: "bruno.prospect@example.invalid", phone: "+55 61 99999-0002" },
  };
  await prisma.journeyProspect.createMany({
    data: [
      {
        id: ids.prospectA,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        responsibleName: "Ana Responsável",
        childName: "Lia Prospectiva",
        email: null,
        phone: null,
        emailHash: hashContact(contacts.a.email),
        phoneHash: hashContact(contacts.a.phone),
        emailCiphertext: encryptContact(contacts.a.email),
        phoneCiphertext: encryptContact(contacts.a.phone),
        contactHashVersion: "hmac-sha256-v1",
        privacyStatus: JourneyProspectPrivacyStatus.ACTIVE,
        captureLegalBasis: Onda1LegalBasis.CONSENT,
        contactLegalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "journey-privacy-v1",
        consentCapturedAt: capturedAt,
        contactConsentAt: capturedAt,
        retentionUntil,
        source: "Site",
        ageGroupMinMonths: 24,
        ageGroupMaxMonths: 36,
        period: "Integral",
        desiredDate: new Date("2026-09-01T12:00:00Z"),
        consentCapture: true,
        consentContact: true,
        stage: JourneyStage.VAGA_OFERECIDA,
        createdBy: ids.adminUser,
        idempotencyKey: "journey-e2e-prospect-a",
      },
      {
        id: ids.prospectB,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        responsibleName: "Bruno Responsável",
        childName: "Noa Prospectiva",
        email: null,
        phone: null,
        emailHash: hashContact(contacts.b.email),
        phoneHash: hashContact(contacts.b.phone),
        emailCiphertext: encryptContact(contacts.b.email),
        phoneCiphertext: encryptContact(contacts.b.phone),
        contactHashVersion: "hmac-sha256-v1",
        privacyStatus: JourneyProspectPrivacyStatus.ACTIVE,
        captureLegalBasis: Onda1LegalBasis.CONSENT,
        contactLegalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "journey-privacy-v1",
        consentCapturedAt: capturedAt,
        contactConsentAt: capturedAt,
        retentionUntil,
        source: "Indicação",
        ageGroupMinMonths: 36,
        ageGroupMaxMonths: 48,
        period: "Parcial",
        desiredDate: new Date("2026-10-01T12:00:00Z"),
        consentCapture: true,
        consentContact: true,
        stage: JourneyStage.LISTA_ESPERA,
        createdBy: ids.adminUser,
        idempotencyKey: "journey-e2e-prospect-b",
      },
      {
        id: ids.isolatedProspect,
        mantenedoraId: ids.tenant,
        unitId: ids.isolatedUnit,
        responsibleName: "Responsável Fora do Escopo",
        childName: "Criança Fora do Escopo",
        email: null,
        phone: null,
        privacyStatus: JourneyProspectPrivacyStatus.ACTIVE,
        captureLegalBasis: Onda1LegalBasis.CONSENT,
        contactLegalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "journey-privacy-v1",
        consentCapturedAt: capturedAt,
        contactConsentAt: capturedAt,
        retentionUntil,
        source: "E2E",
        ageGroupMinMonths: 24,
        ageGroupMaxMonths: 36,
        period: "Integral",
        desiredDate: new Date("2026-09-01T12:00:00Z"),
        consentCapture: true,
        consentContact: true,
        stage: JourneyStage.NOVO,
        createdBy: "journey-e2e-synthetic-actor",
        idempotencyKey: "journey-e2e-isolated-prospect",
      },
      {
        id: ids.foreignProspect,
        mantenedoraId: ids.foreignTenant,
        unitId: ids.foreignUnit,
        responsibleName: "Responsável Organização Estrangeira",
        childName: "Criança Organização Estrangeira",
        email: null,
        phone: null,
        privacyStatus: JourneyProspectPrivacyStatus.ACTIVE,
        captureLegalBasis: Onda1LegalBasis.CONSENT,
        contactLegalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "journey-privacy-v1",
        consentCapturedAt: capturedAt,
        contactConsentAt: capturedAt,
        retentionUntil,
        source: "E2E",
        ageGroupMinMonths: 24,
        ageGroupMaxMonths: 36,
        period: "Integral",
        desiredDate: new Date("2026-09-01T12:00:00Z"),
        consentCapture: true,
        consentContact: true,
        stage: JourneyStage.NOVO,
        createdBy: "journey-e2e-foreign-actor",
        idempotencyKey: "journey-e2e-foreign-prospect",
      },
    ],
  });
  await prisma.journeyProspectStageEvent.createMany({
    data: [
      {
        id: ids.stageA,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: ids.prospectA,
        fromStage: JourneyStage.NOVO,
        toStage: JourneyStage.VAGA_OFERECIDA,
        actorUserId: ids.adminUser,
        idempotencyKey: "journey-e2e-stage-a",
      },
      {
        id: ids.stageB,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: ids.prospectB,
        fromStage: JourneyStage.NOVO,
        toStage: JourneyStage.LISTA_ESPERA,
        actorUserId: ids.adminUser,
        idempotencyKey: "journey-e2e-stage-b",
      },
    ],
  });
  await prisma.journeyWaitlistPolicyVersion.create({
    data: {
      id: ids.policy,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      programKey: "educacao-infantil",
      ageGroupMinMonths: 0,
      ageGroupMaxMonths: 48,
      period: "Parcial",
      version: 1,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      status: JourneyWaitlistPolicyStatus.PUBLICADA,
      priorityDefinition: {
        ageGroupMatch: true,
        periodMatch: true,
        desiredDate: true,
        createdAt: true,
      },
      createdBy: ids.adminUser,
      reviewedBy: ids.admissionsUser,
      publishedBy: ids.directorUser,
      publishedAt: new Date("2026-01-02T00:00:00Z"),
      idempotencyKey: "journey-e2e-policy-v1",
    },
  });
  await prisma.journeyWaitlistEntry.create({
    data: {
      id: ids.waitlist,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectB,
      policyId: ids.policy,
      desiredDate: new Date("2026-10-01T12:00:00Z"),
      priorityScore: 10,
      explanation: { reasons: ["data desejada"] },
      status: JourneyWaitlistEntryStatus.AGUARDANDO,
      createdBy: ids.adminUser,
      idempotencyKey: "journey-e2e-waitlist-b",
    },
  });
  await prisma.journeyVisit.create({
    data: {
      id: ids.visit,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectA,
      startsAt: new Date("2026-08-25T14:00:00Z"),
      endsAt: new Date("2026-08-25T14:30:00Z"),
      status: JourneyVisitStatus.AGENDADA,
      assignedTo: ids.adminUser,
      createdBy: ids.adminUser,
      idempotencyKey: "journey-e2e-visit-a",
    },
  });
  await prisma.journeyVisitEvent.create({
    data: {
      id: ids.visitEvent,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      visitId: ids.visit,
      type: JourneyVisitEventType.CRIADA,
      startsAt: new Date("2026-08-25T14:00:00Z"),
      endsAt: new Date("2026-08-25T14:30:00Z"),
      actorUserId: ids.adminUser,
      idempotencyKey: "journey-e2e-visit-event-a",
    },
  });
  await prisma.journeySeatOffer.create({
    data: {
      id: ids.offer,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectA,
      classroomId: ids.classroom,
      status: JourneyOfferStatus.OFERTADA,
      reservationExpiresAt: new Date("2026-08-30T23:59:59Z"),
      createdBy: ids.adminUser,
      idempotencyKey: "journey-e2e-offer-a",
    },
  });
  console.log(
    JSON.stringify({
      status: "setup",
      users: {
        admin: "journey-admin@example.invalid",
        admissions: "journey-admissions@example.invalid",
        director: "journey-director@example.invalid",
        pedagogy: "journey-pedagogy@example.invalid",
      },
      password,
      tenant: ids.tenant,
      unit: ids.unit,
    }),
  );
}

try {
  if (process.argv[2] === "cleanup") await cleanup();
  else await setup();
} finally {
  await prisma.$disconnect();
}
