import bcrypt from "bcrypt";
import {
  createCipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  AttendanceStatus,
  ClassroomTeacherRole,
  DiaryEventStatus,
  DiaryEventType,
  EnrollmentStatus,
  FamilyCommunicationStatus,
  Gender,
  JourneyActivityType,
  JourneyDuplicateReviewStatus,
  JourneyOfferStatus,
  JourneyProspectPrivacyStatus,
  JourneyStage,
  JourneyTaskStatus,
  JourneyVisitEventType,
  JourneyVisitStatus,
  JourneyWaitlistEntryStatus,
  JourneyWaitlistPolicyStatus,
  Onda1ConsentDecision,
  Onda1ConsentPurpose,
  Onda1LegalBasis,
  PrismaClient,
  RoleLevel,
  RoleType,
  UserStatus,
} from "@prisma/client";

/**
 * Fixture PR22 para demonstração/teste em banco explicitamente autorizado.
 *
 * Propriedades de segurança:
 * - aborta por padrão e exige confirmação explícita;
 * - aceita somente banco local/CI não produtivo;
 * - nunca executa deleteMany, updateMany, drop ou truncate;
 * - usa IDs estáveis e upsert para ser reaplicável;
 * - não grava contatos plaintext de Journey;
 * - nunca imprime senha, segredo ou contato original.
 */

const prisma = new PrismaClient();
const DEMO_CONFIRMATION = "PR22-DEMO-ONLY";
const password = process.env.PR22_DEMO_PASSWORD;
const hmacSecret = process.env.JOURNEY_CONTACT_HMAC_SECRET;
const encryptionSecret = process.env.JOURNEY_CONTACT_ENCRYPTION_SECRET;

const ids = {
  tenant: "pr22-demo-tenant",
  unit: "pr22-demo-unit",
  classroom: "pr22-demo-classroom",
  adminRole: "pr22-demo-admin-role",
  admissionsRole: "pr22-demo-admissions-role",
  directorRole: "pr22-demo-director-role",
  teacherRole: "pr22-demo-teacher-role",
  familyRole: "pr22-demo-family-role",
  adminUser: "pr22-demo-admin-user",
  admissionsUser: "pr22-demo-admissions-user",
  directorUser: "pr22-demo-director-user",
  teacherUser: "pr22-demo-teacher-user",
  familyUser: "pr22-demo-family-user",
  adminUserRole: "pr22-demo-admin-user-role",
  admissionsUserRole: "pr22-demo-admissions-user-role",
  directorUserRole: "pr22-demo-director-user-role",
  teacherUserRole: "pr22-demo-teacher-user-role",
  familyUserRole: "pr22-demo-family-user-role",
  adminScope: "pr22-demo-admin-scope",
  admissionsScope: "pr22-demo-admissions-scope",
  directorScope: "pr22-demo-director-scope",
  teacherScope: "pr22-demo-teacher-scope",
  familyScope: "pr22-demo-family-scope",
  planning: "pr22-demo-planning",
  child01: "pr22-demo-child-01",
  child02: "pr22-demo-child-02",
  child03: "pr22-demo-child-03",
  child04: "pr22-demo-child-04",
  diary01: "pr22-demo-diary-01",
  diary02: "pr22-demo-diary-02",
  observation01: "pr22-demo-observation-01",
  consent01: "pr22-demo-consent-01",
  consent02: "pr22-demo-consent-02",
  consent03: "pr22-demo-consent-03",
  consent04: "pr22-demo-consent-04",
  message01: "pr22-demo-message-01",
  policy: "pr22-demo-policy-v1",
  prospectNew: "pr22-demo-prospect-new",
  prospectVisit: "pr22-demo-prospect-visit",
  prospectWait: "pr22-demo-prospect-wait",
  prospectOffer: "pr22-demo-prospect-offer",
  prospectAccepted: "pr22-demo-prospect-accepted",
  prospectRecused: "pr22-demo-prospect-recused",
  prospectExpired: "pr22-demo-prospect-expired",
  activity01: "pr22-demo-activity-01",
  activity02: "pr22-demo-activity-02",
  task01: "pr22-demo-task-01",
  task02: "pr22-demo-task-02",
  duplicateReview: "pr22-demo-duplicate-review",
  visitScheduled: "pr22-demo-visit-scheduled",
  visitCompleted: "pr22-demo-visit-completed",
  visitAbsent: "pr22-demo-visit-absent",
  visitEventScheduled: "pr22-demo-visit-event-scheduled",
  visitEventCompleted: "pr22-demo-visit-event-completed",
  visitEventAbsent: "pr22-demo-visit-event-absent",
  waitlist01: "pr22-demo-waitlist-01",
  waitlist02: "pr22-demo-waitlist-02",
  offerActive: "pr22-demo-offer-active",
  offerAccepted: "pr22-demo-offer-accepted",
  offerRecused: "pr22-demo-offer-recused",
  offerExpired: "pr22-demo-offer-expired",
  draftAccepted: "pr22-demo-draft-accepted",
};

const childIds = [ids.child01, ids.child02, ids.child03, ids.child04];
const userIds = [
  ids.adminUser,
  ids.admissionsUser,
  ids.directorUser,
  ids.teacherUser,
  ids.familyUser,
];
const roleIds = [
  ids.adminRole,
  ids.admissionsRole,
  ids.directorRole,
  ids.teacherRole,
  ids.familyRole,
];
const userRoleIds = [
  ids.adminUserRole,
  ids.admissionsUserRole,
  ids.directorUserRole,
  ids.teacherUserRole,
  ids.familyUserRole,
];
const scopeIds = [
  ids.adminScope,
  ids.admissionsScope,
  ids.directorScope,
  ids.teacherScope,
  ids.familyScope,
];

function requireEnvironment() {
  if (process.env.ALLOW_SYNTHETIC_SEED !== "true") {
    throw new Error(
      "Fixture PR22 bloqueada: defina ALLOW_SYNTHETIC_SEED=true somente no ambiente autorizado.",
    );
  }
  if (process.env.DEMO_DATA_CONFIRMATION !== DEMO_CONFIRMATION) {
    throw new Error(
      "Fixture PR22 bloqueada: DEMO_DATA_CONFIRMATION=PR22-DEMO-ONLY é obrigatório.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Fixture PR22 bloqueada em NODE_ENV=production.");
  }
  if (!password || password.length < 12) {
    throw new Error(
      "PR22_DEMO_PASSWORD é obrigatório e deve ter ao menos 12 caracteres.",
    );
  }
  if (!hmacSecret || hmacSecret.length < 16) {
    throw new Error(
      "JOURNEY_CONTACT_HMAC_SECRET dedicado é obrigatório para a fixture PR22.",
    );
  }
  if (!encryptionSecret || encryptionSecret.length < 16) {
    throw new Error(
      "JOURNEY_CONTACT_ENCRYPTION_SECRET dedicado é obrigatório para a fixture PR22.",
    );
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl)
    throw new Error("DATABASE_URL é obrigatório para a fixture PR22.");
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(host);
  const syntheticHost = host.endsWith(".test") || host.endsWith(".invalid");
  const ciServiceHost = process.env.CI === "true" && host === "postgres";
  if (!localHost && !syntheticHost && !ciServiceHost) {
    throw new Error(
      `Fixture PR22 bloqueada para o host do banco ${host}; use localhost, loopback, .test, .invalid ou serviço postgres em CI.`,
    );
  }
}

function parseDemoDate() {
  const value =
    process.env.PR22_DEMO_DATE ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("PR22_DEMO_DATE deve usar o formato YYYY-MM-DD.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("PR22_DEMO_DATE inválida.");
  return { value, date };
}

function addDays(date, days, hour = 12) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  result.setUTCHours(hour, 0, 0, 0);
  return result;
}

function hashContact(value) {
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  return `hmac-sha256-v1:${createHmac("sha256", hmacSecret).update(normalized).digest("hex")}`;
}

function encryptionKey() {
  return scryptSync(encryptionSecret, "zelare-journey-contact-v1", 32);
}

function encryptContact(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value.trim(), "utf8"),
    cipher.final(),
  ]);
  return `aes-256-gcm-v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

async function upsertUsers(tx, hashedPassword) {
  const roles = [
    {
      id: ids.adminRole,
      name: "Administrador Demo PR22",
      type: RoleType.UNIDADE_ADMINISTRATIVO,
      level: RoleLevel.UNIDADE,
    },
    {
      id: ids.admissionsRole,
      name: "Admissões Central Demo PR22",
      type: RoleType.STAFF_CENTRAL_ADMISSOES,
      level: RoleLevel.STAFF_CENTRAL,
    },
    {
      id: ids.directorRole,
      name: "Direção Demo PR22",
      type: RoleType.UNIDADE_DIRETOR,
      level: RoleLevel.UNIDADE,
    },
    {
      id: ids.teacherRole,
      name: "Professor Demo PR22",
      type: RoleType.PROFESSOR,
      level: RoleLevel.PROFESSOR,
    },
    {
      id: ids.familyRole,
      name: "Família Demo PR22",
      type: RoleType.FAMILIA_RESPONSAVEL,
      level: RoleLevel.FAMILIA,
    },
  ];
  for (const role of roles) {
    await tx.role.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        level: role.level,
        type: role.type,
        isActive: true,
      },
      create: {
        id: role.id,
        mantenedoraId: ids.tenant,
        name: role.name,
        level: role.level,
        type: role.type,
        isActive: true,
      },
    });
  }

  const users = [
    {
      id: ids.adminUser,
      email: "pr22-admin@demo.invalid",
      firstName: "Admin",
      roleId: ids.adminRole,
      userRoleId: ids.adminUserRole,
      scopeId: ids.adminScope,
      level: RoleLevel.UNIDADE,
    },
    {
      id: ids.admissionsUser,
      email: "pr22-admissions@demo.invalid",
      firstName: "Admissões",
      roleId: ids.admissionsRole,
      userRoleId: ids.admissionsUserRole,
      scopeId: ids.admissionsScope,
      level: RoleLevel.STAFF_CENTRAL,
    },
    {
      id: ids.directorUser,
      email: "pr22-director@demo.invalid",
      firstName: "Direção",
      roleId: ids.directorRole,
      userRoleId: ids.directorUserRole,
      scopeId: ids.directorScope,
      level: RoleLevel.UNIDADE,
    },
    {
      id: ids.teacherUser,
      email: "pr22-teacher@demo.invalid",
      firstName: "Professor",
      roleId: ids.teacherRole,
      userRoleId: ids.teacherUserRole,
      scopeId: ids.teacherScope,
      level: RoleLevel.PROFESSOR,
    },
    {
      id: ids.familyUser,
      email: "pr22-family@demo.invalid",
      firstName: "Família",
      roleId: ids.familyRole,
      userRoleId: ids.familyUserRole,
      scopeId: ids.familyScope,
      level: RoleLevel.FAMILIA,
    },
  ];
  for (const user of users) {
    await tx.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: "Demonstração",
        status: UserStatus.ATIVO,
        emailVerified: true,
        unitId: ids.unit,
      },
      create: {
        id: user.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        email: user.email,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: "Demonstração",
        status: UserStatus.ATIVO,
        emailVerified: true,
      },
    });
    await tx.userRole.upsert({
      where: { id: user.userRoleId },
      update: {
        userId: user.id,
        roleId: user.roleId,
        scopeLevel: user.level,
        isActive: true,
      },
      create: {
        id: user.userRoleId,
        userId: user.id,
        roleId: user.roleId,
        scopeLevel: user.level,
        isActive: true,
      },
    });
    await tx.userRoleUnitScope.upsert({
      where: { id: user.scopeId },
      update: { userRoleId: user.userRoleId, unitId: ids.unit },
      create: {
        id: user.scopeId,
        userRoleId: user.userRoleId,
        unitId: ids.unit,
      },
    });
  }
}

async function upsertCore(tx, demoDate) {
  await tx.mantenedora.upsert({
    where: { id: ids.tenant },
    update: {
      name: "Instituição Demo Sintética PR22",
      email: "pr22-institution@demo.invalid",
      isActive: true,
      plan: "professional",
    },
    create: {
      id: ids.tenant,
      name: "Instituição Demo Sintética PR22",
      email: "pr22-institution@demo.invalid",
      taxIdType: "NONE",
      country: "BR",
      isActive: true,
      plan: "professional",
      maxUnits: 2,
      maxUsers: 50,
    },
  });
  await tx.unit.upsert({
    where: { id: ids.unit },
    update: {
      name: "Unidade Demo Sintética",
      code: "PR22-DEMO",
      capacity: 24,
      ageGroupsServed: "0-6",
      isActive: true,
    },
    create: {
      id: ids.unit,
      mantenedoraId: ids.tenant,
      name: "Unidade Demo Sintética",
      code: "PR22-DEMO",
      capacity: 24,
      ageGroupsServed: "0-6",
      isActive: true,
    },
  });
  await tx.classroom.upsert({
    where: { id: ids.classroom },
    update: {
      unitId: ids.unit,
      name: "Turma Descobertas",
      code: "PR22-T01",
      ageGroupMin: 24,
      ageGroupMax: 48,
      capacity: 12,
      isActive: true,
    },
    create: {
      id: ids.classroom,
      unitId: ids.unit,
      name: "Turma Descobertas",
      code: "PR22-T01",
      ageGroupMin: 24,
      ageGroupMax: 48,
      capacity: 12,
      isActive: true,
    },
  });
  await tx.tenantFeatureFlag.upsert({
    where: {
      mantenedoraId_flagKey: {
        mantenedoraId: ids.tenant,
        flagKey: "journey_admissions_v1",
      },
    },
    update: { enabled: true, config: { scope: "pr22-demo-only" } },
    create: {
      mantenedoraId: ids.tenant,
      flagKey: "journey_admissions_v1",
      enabled: true,
      config: { scope: "pr22-demo-only" },
    },
  });

  const hashedPassword = await bcrypt.hash(password, 10);
  await upsertUsers(tx, hashedPassword);
  await tx.classroomTeacher.upsert({
    where: {
      classroomId_teacherId: {
        classroomId: ids.classroom,
        teacherId: ids.teacherUser,
      },
    },
    update: { role: ClassroomTeacherRole.MAIN, isActive: true },
    create: {
      classroomId: ids.classroom,
      teacherId: ids.teacherUser,
      role: ClassroomTeacherRole.MAIN,
      isActive: true,
    },
  });

  await tx.planning.upsert({
    where: { id: ids.planning },
    update: {
      title: "Semana das Descobertas",
      description: JSON.stringify({
        version: 2,
        days: [
          {
            date: demoDate.value,
            objectives: ["Explorar sons, movimentos e formas de convivência."],
          },
        ],
      }),
      type: "SEMANAL",
      startDate: addDays(demoDate.date, -2, 0),
      endDate: addDays(demoDate.date, 5, 23),
      status: "APROVADO",
      professorId: ids.teacherUser,
      createdBy: ids.teacherUser,
      updatedBy: ids.teacherUser,
      reviewedBy: ids.adminUser,
      reviewedAt: addDays(demoDate.date, -1, 15),
      publishedAt: addDays(demoDate.date, -1, 16),
      pedagogicalContent: {
        experiences: ["Circuito de movimentos", "Roda de histórias"],
      },
      activities: ["Circuito de movimentos", "Roda de histórias"],
      objectives: "Explorar sons, movimentos e formas de convivência.",
      anoLetivo: Number(demoDate.value.slice(0, 4)),
    },
    create: {
      id: ids.planning,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      classroomId: ids.classroom,
      title: "Semana das Descobertas",
      description: JSON.stringify({
        version: 2,
        days: [
          {
            date: demoDate.value,
            objectives: ["Explorar sons, movimentos e formas de convivência."],
          },
        ],
      }),
      type: "SEMANAL",
      startDate: addDays(demoDate.date, -2, 0),
      endDate: addDays(demoDate.date, 5, 23),
      status: "APROVADO",
      professorId: ids.teacherUser,
      createdBy: ids.teacherUser,
      reviewedBy: ids.adminUser,
      reviewedAt: addDays(demoDate.date, -1, 15),
      publishedAt: addDays(demoDate.date, -1, 16),
      pedagogicalContent: {
        experiences: ["Circuito de movimentos", "Roda de histórias"],
      },
      activities: ["Circuito de movimentos", "Roda de histórias"],
      objectives: "Explorar sons, movimentos e formas de convivência.",
      anoLetivo: Number(demoDate.value.slice(0, 4)),
    },
  });

  const children = [
    {
      id: ids.child01,
      firstName: "Lumi",
      lastName: "Demo 01",
      gender: Gender.FEMININO,
      dob: addDays(demoDate.date, -1095, 0),
    },
    {
      id: ids.child02,
      firstName: "Nilo",
      lastName: "Demo 02",
      gender: Gender.MASCULINO,
      dob: addDays(demoDate.date, -1000, 0),
    },
    {
      id: ids.child03,
      firstName: "Ari",
      lastName: "Demo 03",
      gender: Gender.OUTRO,
      dob: addDays(demoDate.date, -920, 0),
    },
    {
      id: ids.child04,
      firstName: "Lua",
      lastName: "Demo 04",
      gender: Gender.FEMININO,
      dob: addDays(demoDate.date, -850, 0),
    },
  ];
  for (const child of children) {
    await tx.child.upsert({
      where: { id: child.id },
      update: {
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dob,
        gender: child.gender,
        unitId: ids.unit,
        isActive: true,
        createdBy: ids.adminUser,
      },
      create: {
        id: child.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dob,
        gender: child.gender,
        isActive: true,
        createdBy: ids.adminUser,
      },
    });
    await tx.enrollment.upsert({
      where: {
        childId_classroomId: { childId: child.id, classroomId: ids.classroom },
      },
      update: {
        enrollmentDate: addDays(demoDate.date, -30, 0),
        status: EnrollmentStatus.ATIVA,
      },
      create: {
        childId: child.id,
        classroomId: ids.classroom,
        enrollmentDate: addDays(demoDate.date, -30, 0),
        status: EnrollmentStatus.ATIVA,
        createdBy: ids.adminUser,
      },
    });
  }
  await tx.childGuardian.upsert({
    where: { childId_userId: { childId: ids.child01, userId: ids.familyUser } },
    update: {
      relationship: "Responsável sintético",
      isPrimary: true,
      canViewTimeline: true,
      canViewDevelopment: true,
      canViewHealth: false,
      consentAt: addDays(demoDate.date, -20, 12),
      revokedAt: null,
      legalBasis: Onda1LegalBasis.CONSENT,
      consentPolicyVersion: "family-link-v1",
      retentionUntil: addDays(demoDate.date, 365, 23),
      revocationReason: null,
    },
    create: {
      id: "pr22-demo-child-guardian-01",
      childId: ids.child01,
      userId: ids.familyUser,
      relationship: "Responsável sintético",
      isPrimary: true,
      canViewTimeline: true,
      canViewDevelopment: true,
      canViewHealth: false,
      consentAt: addDays(demoDate.date, -20, 12),
      legalBasis: Onda1LegalBasis.CONSENT,
      consentPolicyVersion: "family-link-v1",
      retentionUntil: addDays(demoDate.date, 365, 23),
    },
  });
  await tx.consentGrant.upsert({
    where: { id: ids.consent01 },
    update: {
      decision: Onda1ConsentDecision.CONCEDIDO,
      legalBasis: Onda1LegalBasis.CONSENT,
      policyVersion: "family-link-v1",
      responsibleUserId: ids.familyUser,
      validUntil: addDays(demoDate.date, 365, 23),
      revokedAt: null,
    },
    create: {
      id: ids.consent01,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      childId: ids.child01,
      responsibleUserId: ids.familyUser,
      purpose: Onda1ConsentPurpose.VINCULO_ACESSO,
      decision: Onda1ConsentDecision.CONCEDIDO,
      legalBasis: Onda1LegalBasis.CONSENT,
      policyVersion: "family-link-v1",
      textPresented:
        "Acesso sintético à timeline da criança para demonstração PR22.",
      origin: "pr22-demo-fixture",
      proof: { synthetic: true, fixture: "PR22" },
      validFrom: addDays(demoDate.date, -20, 12),
      validUntil: addDays(demoDate.date, 365, 23),
      decidedAt: addDays(demoDate.date, -20, 12),
    },
  });

  const attendance = [
    {
      id: "pr22-demo-attendance-01",
      childId: ids.child01,
      status: AttendanceStatus.PRESENTE,
    },
    {
      id: "pr22-demo-attendance-02",
      childId: ids.child02,
      status: AttendanceStatus.PRESENTE,
    },
    {
      id: "pr22-demo-attendance-03",
      childId: ids.child03,
      status: AttendanceStatus.PRESENTE,
    },
    {
      id: "pr22-demo-attendance-04",
      childId: ids.child04,
      status: AttendanceStatus.AUSENTE,
    },
  ];
  for (const record of attendance) {
    await tx.attendance.upsert({
      where: { id: record.id },
      update: {
        date: demoDate.date,
        status: record.status,
        recordedBy: ids.teacherUser,
      },
      create: {
        id: record.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        classroomId: ids.classroom,
        childId: record.childId,
        date: demoDate.date,
        status: record.status,
        recordedBy: ids.teacherUser,
      },
    });
  }
  await tx.diaryEvent.upsert({
    where: { id: ids.diary01 },
    update: {
      title: "Circuito de sons e movimentos",
      description:
        "As crianças exploraram sons, ritmos e movimentos em pequenos grupos.",
      eventDate: addDays(demoDate.date, 0, 10),
      status: DiaryEventStatus.PUBLICADO,
      reviewedBy: ids.adminUser,
      publishedAt: addDays(demoDate.date, 0, 16),
      observations: "Participação espontânea e cooperação durante a atividade.",
      developmentNotes: "Experimentou diferentes formas de expressão corporal.",
    },
    create: {
      id: ids.diary01,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      classroomId: ids.classroom,
      childId: ids.child01,
      planningId: ids.planning,
      type: DiaryEventType.ATIVIDADE_PEDAGOGICA,
      title: "Circuito de sons e movimentos",
      description:
        "As crianças exploraram sons, ritmos e movimentos em pequenos grupos.",
      eventDate: addDays(demoDate.date, 0, 10),
      status: DiaryEventStatus.PUBLICADO,
      createdBy: ids.teacherUser,
      reviewedBy: ids.adminUser,
      publishedAt: addDays(demoDate.date, 0, 16),
      observations: "Participação espontânea e cooperação durante a atividade.",
      developmentNotes: "Experimentou diferentes formas de expressão corporal.",
      tags: ["movimento", "expressão"],
    },
  });
  await tx.diaryEvent.upsert({
    where: { id: ids.diary02 },
    update: {
      title: "Roda de histórias",
      description:
        "Registro sintético de leitura compartilhada e escuta do grupo.",
      eventDate: addDays(demoDate.date, -1, 13),
      status: DiaryEventStatus.PUBLICADO,
      reviewedBy: ids.adminUser,
      publishedAt: addDays(demoDate.date, -1, 16),
    },
    create: {
      id: ids.diary02,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      classroomId: ids.classroom,
      childId: ids.child02,
      planningId: ids.planning,
      type: DiaryEventType.OBSERVACAO,
      title: "Roda de histórias",
      description:
        "Registro sintético de leitura compartilhada e escuta do grupo.",
      eventDate: addDays(demoDate.date, -1, 13),
      status: DiaryEventStatus.PUBLICADO,
      createdBy: ids.teacherUser,
      reviewedBy: ids.adminUser,
      publishedAt: addDays(demoDate.date, -1, 16),
      observations: "Acompanhou a narrativa e participou da conversa final.",
    },
  });
  await tx.developmentObservation.upsert({
    where: { id: ids.observation01 },
    update: {
      classroomId: ids.classroom,
      createdBy: ids.teacherUser,
      date: addDays(demoDate.date, -1, 14),
      category: "DEMONSTRAÇÃO",
      learningProgress: "Participa das propostas com curiosidade e iniciativa.",
      socialInteraction: "Interage com pares e aceita combinados simples.",
      languageSkills: "Amplia a escuta e o repertório de palavras.",
      tags: ["sintético", "PR22"],
      indicadores: {
        participacao: "em_desenvolvimento",
        cooperacao: "consolidando",
      },
    },
    create: {
      id: ids.observation01,
      childId: ids.child01,
      classroomId: ids.classroom,
      createdBy: ids.teacherUser,
      date: addDays(demoDate.date, -1, 14),
      category: "DEMONSTRAÇÃO",
      learningProgress: "Participa das propostas com curiosidade e iniciativa.",
      socialInteraction: "Interage com pares e aceita combinados simples.",
      languageSkills: "Amplia a escuta e o repertório de palavras.",
      tags: ["sintético", "PR22"],
      indicadores: {
        participacao: "em_desenvolvimento",
        cooperacao: "consolidando",
      },
    },
  });
  await tx.familyCommunication.upsert({
    where: { id: ids.message01 },
    update: {
      subject: "Registro da semana",
      body: "A turma participou de uma proposta de sons e movimentos. Mensagem sintética PR22.",
      status: FamilyCommunicationStatus.ENVIADA,
      recipientUserId: ids.familyUser,
      senderUserId: ids.teacherUser,
    },
    create: {
      id: ids.message01,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      childId: ids.child01,
      senderUserId: ids.teacherUser,
      recipientUserId: ids.familyUser,
      subject: "Registro da semana",
      body: "A turma participou de uma proposta de sons e movimentos. Mensagem sintética PR22.",
      status: FamilyCommunicationStatus.ENVIADA,
    },
  });
}

const prospectDefinitions = [
  {
    id: ids.prospectNew,
    name: "Ravi Demo Novo",
    child: "Criança Prospectiva 01",
    stage: JourneyStage.NOVO,
    source: "Site",
    period: "Integral",
    desiredOffset: 20,
  },
  {
    id: ids.prospectVisit,
    name: "Maya Demo Visita",
    child: "Criança Prospectiva 02",
    stage: JourneyStage.VISITA_REALIZADA,
    source: "Evento demo",
    period: "Integral",
    desiredOffset: 30,
  },
  {
    id: ids.prospectWait,
    name: "Iara Demo Espera",
    child: "Criança Prospectiva 03",
    stage: JourneyStage.LISTA_ESPERA,
    source: "Indicação sintética",
    period: "Integral",
    desiredOffset: 45,
  },
  {
    id: ids.prospectOffer,
    name: "Theo Demo Oferta",
    child: "Criança Prospectiva 04",
    stage: JourneyStage.VAGA_OFERECIDA,
    source: "Site",
    period: "Integral",
    desiredOffset: 15,
  },
  {
    id: ids.prospectAccepted,
    name: "Nina Demo Aceite",
    child: "Criança Prospectiva 05",
    stage: JourneyStage.ACEITO,
    source: "Feira demo",
    period: "Integral",
    desiredOffset: 10,
  },
  {
    id: ids.prospectRecused,
    name: "Bia Demo Recusa",
    child: "Criança Prospectiva 06",
    stage: JourneyStage.PERDIDO,
    source: "Site",
    period: "Parcial",
    desiredOffset: 60,
  },
  {
    id: ids.prospectExpired,
    name: "Caio Demo Expirada",
    child: "Criança Prospectiva 07",
    stage: JourneyStage.PERDIDO,
    source: "Evento demo",
    period: "Integral",
    desiredOffset: -10,
  },
];

async function upsertJourney(tx, demoDate) {
  const capturedAt = addDays(demoDate.date, -12, 12);
  const retentionUntil = addDays(demoDate.date, 180, 23);
  for (const [index, prospect] of prospectDefinitions.entries()) {
    const email = `pr22-lead-${String(index + 1).padStart(2, "0")}@demo.invalid`;
    const phone = `+55 61 99999-${String(2201 + index).padStart(4, "0")}`;
    await tx.journeyProspect.upsert({
      where: { id: prospect.id },
      update: {
        responsibleName: prospect.name,
        childName: prospect.child,
        email: null,
        phone: null,
        emailHash: hashContact(email),
        phoneHash: hashContact(phone),
        emailCiphertext: encryptContact(email),
        phoneCiphertext: encryptContact(phone),
        contactHashVersion: "hmac-sha256-v1",
        privacyStatus: JourneyProspectPrivacyStatus.ACTIVE,
        captureLegalBasis: Onda1LegalBasis.CONSENT,
        contactLegalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "journey-privacy-v1",
        consentCapturedAt: capturedAt,
        contactConsentAt: capturedAt,
        retentionUntil,
        source: prospect.source,
        ageGroupMinMonths: 24,
        ageGroupMaxMonths: 48,
        period: prospect.period,
        desiredDate: addDays(demoDate.date, prospect.desiredOffset, 12),
        consentCapture: true,
        consentContact: true,
        stage: prospect.stage,
        createdBy: ids.admissionsUser,
      },
      create: {
        id: prospect.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        responsibleName: prospect.name,
        childName: prospect.child,
        email: null,
        phone: null,
        emailHash: hashContact(email),
        phoneHash: hashContact(phone),
        emailCiphertext: encryptContact(email),
        phoneCiphertext: encryptContact(phone),
        contactHashVersion: "hmac-sha256-v1",
        privacyStatus: JourneyProspectPrivacyStatus.ACTIVE,
        captureLegalBasis: Onda1LegalBasis.CONSENT,
        contactLegalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "journey-privacy-v1",
        consentCapturedAt: capturedAt,
        contactConsentAt: capturedAt,
        retentionUntil,
        source: prospect.source,
        ageGroupMinMonths: 24,
        ageGroupMaxMonths: 48,
        period: prospect.period,
        desiredDate: addDays(demoDate.date, prospect.desiredOffset, 12),
        consentCapture: true,
        consentContact: true,
        stage: prospect.stage,
        createdBy: ids.admissionsUser,
        idempotencyKey: `pr22-demo-${prospect.id}`,
      },
    });
    await tx.journeyProspectStageEvent.upsert({
      where: { id: `pr22-demo-stage-${index + 1}` },
      update: { toStage: prospect.stage, actorUserId: ids.admissionsUser },
      create: {
        id: `pr22-demo-stage-${index + 1}`,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: prospect.id,
        fromStage: JourneyStage.NOVO,
        toStage: prospect.stage,
        actorUserId: ids.admissionsUser,
        idempotencyKey: `pr22-demo-stage-${index + 1}`,
      },
    });
    await tx.journeyProspectPrivacyEvent.upsert({
      where: { id: `pr22-demo-privacy-capture-${index + 1}` },
      update: {
        actorUserId: ids.admissionsUser,
        policyVersion: "journey-privacy-v1",
      },
      create: {
        id: `pr22-demo-privacy-capture-${index + 1}`,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: prospect.id,
        type: "CONSENT_CAPTURED",
        purpose: "CAPTACAO",
        legalBasis: Onda1LegalBasis.CONSENT,
        policyVersion: "journey-privacy-v1",
        reason: "Consentimento sintético da fixture PR22.",
        actorUserId: ids.admissionsUser,
        idempotencyKey: `pr22-demo-privacy-capture-${index + 1}`,
      },
    });
    await tx.journeyProspectPrivacyEvent.upsert({
      where: { id: `pr22-demo-privacy-contact-${index + 1}` },
      update: {
        actorUserId: ids.admissionsUser,
        policyVersion: "journey-privacy-v1",
      },
      create: {
        id: `pr22-demo-privacy-contact-${index + 1}`,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: prospect.id,
        type: "CONSENT_CONTACT_GRANTED",
        purpose: "CONTATO",
        legalBasis: Onda1LegalBasis.CONSENT,
        policyVersion: "journey-privacy-v1",
        reason: "Contato sintético autorizado para demonstração PR22.",
        actorUserId: ids.admissionsUser,
        idempotencyKey: `pr22-demo-privacy-contact-${index + 1}`,
      },
    });
  }

  await tx.journeyWaitlistPolicyVersion.upsert({
    where: { id: ids.policy },
    update: {
      period: "Integral",
      status: JourneyWaitlistPolicyStatus.PUBLICADA,
      effectiveFrom: addDays(demoDate.date, -90, 0),
      publishedBy: ids.directorUser,
      publishedAt: addDays(demoDate.date, -89, 12),
      reviewedBy: ids.admissionsUser,
      reviewedAt: addDays(demoDate.date, -89, 10),
    },
    create: {
      id: ids.policy,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      programKey: "educacao-infantil-demo",
      ageGroupMinMonths: 0,
      ageGroupMaxMonths: 72,
      period: "Integral",
      version: 1,
      effectiveFrom: addDays(demoDate.date, -90, 0),
      status: JourneyWaitlistPolicyStatus.PUBLICADA,
      priorityDefinition: {
        ageGroupMatch: true,
        periodMatch: true,
        desiredDate: true,
        createdAt: true,
      },
      createdBy: ids.adminUser,
      reviewedBy: ids.admissionsUser,
      reviewedAt: addDays(demoDate.date, -89, 10),
      publishedBy: ids.directorUser,
      publishedAt: addDays(demoDate.date, -89, 12),
      idempotencyKey: "pr22-demo-policy-v1",
    },
  });
  const waitlists = [
    {
      id: ids.waitlist01,
      prospectId: ids.prospectWait,
      score: 90,
      dateOffset: 45,
    },
    {
      id: ids.waitlist02,
      prospectId: ids.prospectNew,
      score: 60,
      dateOffset: 20,
    },
  ];
  for (const [index, entry] of waitlists.entries()) {
    await tx.journeyWaitlistEntry.upsert({
      where: { id: entry.id },
      update: {
        priorityScore: entry.score,
        desiredDate: addDays(demoDate.date, entry.dateOffset, 12),
        status: JourneyWaitlistEntryStatus.AGUARDANDO,
        policyId: ids.policy,
      },
      create: {
        id: entry.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: entry.prospectId,
        policyId: ids.policy,
        desiredDate: addDays(demoDate.date, entry.dateOffset, 12),
        priorityScore: entry.score,
        explanation: {
          reasons: ["faixa etária", "período", "data desejada"],
          synthetic: true,
        },
        status: JourneyWaitlistEntryStatus.AGUARDANDO,
        createdBy: ids.admissionsUser,
        idempotencyKey: `pr22-demo-waitlist-${index + 1}`,
      },
    });
  }

  const visits = [
    {
      id: ids.visitScheduled,
      prospectId: ids.prospectNew,
      status: JourneyVisitStatus.AGENDADA,
      startOffset: 2,
      eventId: ids.visitEventScheduled,
      eventType: JourneyVisitEventType.CRIADA,
    },
    {
      id: ids.visitCompleted,
      prospectId: ids.prospectVisit,
      status: JourneyVisitStatus.REALIZADA,
      startOffset: -2,
      eventId: ids.visitEventCompleted,
      eventType: JourneyVisitEventType.PRESENCA_CONFIRMADA,
    },
    {
      id: ids.visitAbsent,
      prospectId: ids.prospectWait,
      status: JourneyVisitStatus.AUSENCIA,
      startOffset: -5,
      eventId: ids.visitEventAbsent,
      eventType: JourneyVisitEventType.AUSENCIA_REGISTRADA,
    },
  ];
  for (const visit of visits) {
    const startsAt = addDays(demoDate.date, visit.startOffset, 14);
    const endsAt = addDays(demoDate.date, visit.startOffset, 15);
    await tx.journeyVisit.upsert({
      where: { id: visit.id },
      update: {
        startsAt,
        endsAt,
        status: visit.status,
        notes: "Registro de visita sintético PR22.",
        assignedTo: ids.admissionsUser,
      },
      create: {
        id: visit.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: visit.prospectId,
        startsAt,
        endsAt,
        status: visit.status,
        assignedTo: ids.admissionsUser,
        notes: "Registro de visita sintético PR22.",
        createdBy: ids.admissionsUser,
        idempotencyKey: `pr22-demo-visit-${visit.id}`,
      },
    });
    await tx.journeyVisitEvent.upsert({
      where: { id: visit.eventId },
      update: {
        type: visit.eventType,
        startsAt,
        endsAt,
        actorUserId: ids.admissionsUser,
      },
      create: {
        id: visit.eventId,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        visitId: visit.id,
        type: visit.eventType,
        startsAt,
        endsAt,
        note: "Evento de visita sintético PR22.",
        actorUserId: ids.admissionsUser,
        idempotencyKey: `pr22-demo-event-${visit.id}`,
      },
    });
  }

  const offers = [
    {
      id: ids.offerActive,
      prospectId: ids.prospectOffer,
      status: JourneyOfferStatus.OFERTADA,
      expires: 14,
      draft: null,
    },
    {
      id: ids.offerAccepted,
      prospectId: ids.prospectAccepted,
      status: JourneyOfferStatus.ACEITA,
      expires: 12,
      draft: ids.draftAccepted,
    },
    {
      id: ids.offerRecused,
      prospectId: ids.prospectRecused,
      status: JourneyOfferStatus.RECUSADA,
      expires: -4,
      draft: null,
    },
    {
      id: ids.offerExpired,
      prospectId: ids.prospectExpired,
      status: JourneyOfferStatus.EXPIRADA,
      expires: -10,
      draft: null,
    },
  ];
  for (const offer of offers) {
    await tx.journeySeatOffer.upsert({
      where: { id: offer.id },
      update: {
        status: offer.status,
        reservationExpiresAt: addDays(demoDate.date, offer.expires, 23),
        offeredAt: addDays(demoDate.date, -3, 12),
        respondedAt:
          offer.status === JourneyOfferStatus.OFERTADA
            ? null
            : addDays(demoDate.date, -1, 13),
        decisionReason:
          offer.status === JourneyOfferStatus.RECUSADA
            ? "Decisão sintética da família."
            : null,
        acceptedBy:
          offer.status === JourneyOfferStatus.ACEITA
            ? ids.admissionsUser
            : null,
      },
      create: {
        id: offer.id,
        mantenedoraId: ids.tenant,
        unitId: ids.unit,
        prospectId: offer.prospectId,
        classroomId: ids.classroom,
        status: offer.status,
        reservationExpiresAt: addDays(demoDate.date, offer.expires, 23),
        offeredAt: addDays(demoDate.date, -3, 12),
        respondedAt:
          offer.status === JourneyOfferStatus.OFERTADA
            ? null
            : addDays(demoDate.date, -1, 13),
        decisionReason:
          offer.status === JourneyOfferStatus.RECUSADA
            ? "Decisão sintética da família."
            : null,
        createdBy: ids.admissionsUser,
        acceptedBy:
          offer.status === JourneyOfferStatus.ACEITA
            ? ids.admissionsUser
            : null,
        idempotencyKey: `pr22-demo-offer-${offer.id}`,
      },
    });
    if (offer.draft) {
      await tx.journeyEnrollmentDraft.upsert({
        where: { id: offer.draft },
        update: {
          offerId: offer.id,
          prospectId: offer.prospectId,
          status: "INCOMPLETA",
          missingFields: ["documentos", "responsável"],
          createdBy: ids.admissionsUser,
        },
        create: {
          id: offer.draft,
          mantenedoraId: ids.tenant,
          unitId: ids.unit,
          prospectId: offer.prospectId,
          offerId: offer.id,
          status: "INCOMPLETA",
          missingFields: ["documentos", "responsável"],
          acceptedAt: addDays(demoDate.date, -1, 13),
          createdBy: ids.admissionsUser,
          idempotencyKey: "pr22-demo-draft-accepted",
        },
      });
    }
  }

  await tx.journeyActivity.upsert({
    where: { id: ids.activity01 },
    update: {
      title: "Contato inicial",
      note: "Interação sintética registrada para demonstração.",
      actorUserId: ids.admissionsUser,
    },
    create: {
      id: ids.activity01,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectNew,
      type: JourneyActivityType.INTERACAO,
      title: "Contato inicial",
      note: "Interação sintética registrada para demonstração.",
      occurredAt: addDays(demoDate.date, -1, 11),
      nextAction: "Confirmar visita",
      actorUserId: ids.admissionsUser,
      idempotencyKey: "pr22-demo-activity-01",
    },
  });
  await tx.journeyActivity.upsert({
    where: { id: ids.activity02 },
    update: {
      title: "Follow-up da visita",
      note: "Follow-up sintético após visita concluída.",
      actorUserId: ids.admissionsUser,
    },
    create: {
      id: ids.activity02,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectVisit,
      type: JourneyActivityType.FOLLOW_UP,
      title: "Follow-up da visita",
      note: "Follow-up sintético após visita concluída.",
      occurredAt: addDays(demoDate.date, -1, 15),
      nextAction: "Enviar resumo",
      actorUserId: ids.admissionsUser,
      idempotencyKey: "pr22-demo-activity-02",
    },
  });
  await tx.journeyTask.upsert({
    where: { id: ids.task01 },
    update: {
      title: "Confirmar visita",
      status: JourneyTaskStatus.ABERTA,
      assignedTo: ids.admissionsUser,
      createdBy: ids.admissionsUser,
    },
    create: {
      id: ids.task01,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectNew,
      title: "Confirmar visita",
      dueAt: addDays(demoDate.date, 1, 12),
      assignedTo: ids.admissionsUser,
      status: JourneyTaskStatus.ABERTA,
      createdBy: ids.admissionsUser,
      idempotencyKey: "pr22-demo-task-01",
    },
  });
  await tx.journeyTask.upsert({
    where: { id: ids.task02 },
    update: {
      title: "Registrar retorno",
      status: JourneyTaskStatus.CONCLUIDA,
      assignedTo: ids.admissionsUser,
      completedBy: ids.admissionsUser,
      completedAt: addDays(demoDate.date, -1, 16),
      createdBy: ids.admissionsUser,
    },
    create: {
      id: ids.task02,
      mantenedoraId: ids.tenant,
      unitId: ids.unit,
      prospectId: ids.prospectVisit,
      title: "Registrar retorno",
      dueAt: addDays(demoDate.date, -2, 12),
      assignedTo: ids.admissionsUser,
      status: JourneyTaskStatus.CONCLUIDA,
      createdBy: ids.admissionsUser,
      completedBy: ids.admissionsUser,
      completedAt: addDays(demoDate.date, -1, 16),
      idempotencyKey: "pr22-demo-task-02",
    },
  });
  await tx.journeyDuplicateReview.upsert({
    where: { id: ids.duplicateReview },
    update: {
      status: JourneyDuplicateReviewStatus.PENDENTE,
      matchReasons: ["nome sintético semelhante"],
      reviewedBy: null,
      reviewedAt: null,
    },
    create: {
      id: ids.duplicateReview,
      mantenedoraId: ids.tenant,
      primaryProspectId: ids.prospectNew,
      duplicateProspectId: ids.prospectOffer,
      matchReasons: ["nome sintético semelhante"],
      status: JourneyDuplicateReviewStatus.PENDENTE,
      idempotencyKey: "pr22-demo-duplicate-review",
    },
  });
}

async function main() {
  requireEnvironment();
  const demoDate = parseDemoDate();
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    await upsertCore(tx, demoDate);
    await upsertJourney(tx, demoDate);
  });
  console.log(
    JSON.stringify({
      status: "seeded",
      fixture: "PR22-DEMO",
      tenantId: ids.tenant,
      unitId: ids.unit,
      classroomId: ids.classroom,
      demoDate: demoDate.value,
      syntheticUsers: [
        "pr22-admin@demo.invalid",
        "pr22-admissions@demo.invalid",
        "pr22-director@demo.invalid",
        "pr22-teacher@demo.invalid",
        "pr22-family@demo.invalid",
      ],
      passwordProvided: Boolean(hashedPassword),
      plaintextJourneyContacts: false,
      destructiveOperations: false,
      journeyDraftOnlyOnAcceptance: true,
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      "Fixture PR22 não aplicada:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
