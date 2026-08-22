import { ConflictException, GoneException } from "@nestjs/common";
/* O mock Prisma é deliberadamente parcial nesta suíte unitária; integração real é coberta pelo harness descartável. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import {
  JourneyOfferStatus,
  JourneyStage,
  JourneyWaitlistPolicyStatus,
  RoleLevel,
  RoleType,
  UserStatus,
} from "@prisma/client";
import { JourneyService } from "./journey.service";
import { JourneyAccessService } from "./journey-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

const operator: JwtPayload = {
  sub: "operator-1",
  email: "operator@example.invalid",
  mantenedoraId: "tenant-a",
  unitId: "unit-a",
  roles: [
    {
      roleId: "role-a",
      level: RoleLevel.UNIDADE,
      type: RoleType.UNIDADE_ADMINISTRATIVO,
      unitScopes: ["unit-a"],
    },
  ],
};

const prospect = {
  id: "prospect-1",
  mantenedoraId: "tenant-a",
  unitId: "unit-a",
  responsibleName: "Responsável Sintético",
  childName: "Criança Sintética",
  emailHash: "email-hash",
  phoneHash: null,
  declaredIdentityHash: null,
  stage: JourneyStage.NOVO,
  version: 1,
};

function build() {
  const prisma: any = {
    tenantFeatureFlag: {
      findUnique: jest.fn().mockResolvedValue({ enabled: true }),
    },
    unit: {
      findFirst: jest.fn().mockResolvedValue({ id: "unit-a" }),
      findMany: jest.fn().mockResolvedValue([{ id: "unit-a" }]),
    },
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: "operator-2", status: UserStatus.ATIVO }),
    },
    journeyProspect: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    journeyProspectStageEvent: { findUnique: jest.fn(), create: jest.fn() },
    journeyDuplicateReview: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    journeyActivity: { findUnique: jest.fn(), create: jest.fn() },
    journeyTask: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    journeyVisit: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    journeyVisitEvent: { findUnique: jest.fn(), create: jest.fn() },
    journeyWaitlistPolicyVersion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    journeyWaitlistEntry: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    journeySeatOffer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    journeyEnrollmentDraft: { findUnique: jest.fn(), create: jest.fn() },
    classroom: {
      findFirst: jest.fn().mockResolvedValue({
        id: "class-a",
        unitId: "unit-a",
        capacity: 1,
        ageGroupMin: 0,
        ageGroupMax: 48,
        isActive: true,
      }),
      findMany: jest.fn(),
    },
    enrollment: { count: jest.fn().mockResolvedValue(0) },
    domainOutboxEvent: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: any) => unknown) =>
    callback(prisma),
  );
  const access: any = {
    assertAccess: jest.fn().mockResolvedValue(undefined),
    assertUnitAccess: jest.fn().mockResolvedValue(undefined),
    assertProspectAccess: jest.fn().mockResolvedValue({
      ...prospect,
      period: "Integral",
      ageGroupMinMonths: 0,
      ageGroupMaxMonths: 48,
      desiredDate: null,
    }),
    assertClassroomAccess: jest.fn().mockResolvedValue({
      id: "class-a",
      unitId: "unit-a",
      capacity: 1,
      ageGroupMin: 0,
      ageGroupMax: 48,
      isActive: true,
    }),
    accessibleUnitIds: jest.fn().mockResolvedValue(["unit-a"]),
  };
  const audit: any = { logCreate: jest.fn(), logUpdate: jest.fn() };
  return {
    prisma,
    access,
    audit,
    service: new JourneyService(
      prisma as PrismaService,
      access as JourneyAccessService,
      audit as AuditService,
    ),
  };
}

function createDto(overrides: Record<string, unknown> = {}) {
  return {
    responsibleName: "Responsável Sintético",
    childName: "Criança Sintética",
    email: "family@example.invalid",
    phone: "+55 61 99999-0000",
    source: "Site",
    unitId: "unit-a",
    ageGroupMinMonths: 0,
    ageGroupMaxMonths: 48,
    period: "Integral",
    consentCapture: true,
    consentContact: true,
    idempotencyKey: "prospect-command-001",
    ...overrides,
  };
}

describe("JourneyService", () => {
  it("detecta duplicidade por organização, cria revisão humana e não retorna hashes", async () => {
    const { service, prisma } = build();
    prisma.journeyProspect.findUnique.mockResolvedValueOnce(null);
    prisma.journeyProspect.findMany.mockResolvedValueOnce([
      {
        ...prospect,
        emailHash:
          "d52ee3c4d681c35f93a47ca5f6344759a34c129ecac814ee9d9c88abc512c7a2",
      },
    ]);
    prisma.journeyProspect.create.mockResolvedValueOnce({
      ...prospect,
      id: "prospect-2",
    });
    prisma.journeyProspectStageEvent.create.mockResolvedValueOnce({
      id: "stage-2",
    });
    prisma.journeyDuplicateReview.upsert.mockResolvedValueOnce({
      id: "review-1",
    });
    prisma.domainOutboxEvent.create.mockResolvedValueOnce({ id: "outbox-1" });

    const result = await service.createProspect(createDto(), operator);

    expect(result.possibleDuplicates).toEqual([
      {
        id: "prospect-1",
        unitId: "unit-a",
        responsibleName: "Responsável Sintético",
        childName: "Criança Sintética",
        stage: JourneyStage.NOVO,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("emailHash");
    expect(prisma.journeyDuplicateReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          matchReasons: ["email"],
          mantenedoraId: "tenant-a",
        }),
      }),
    );
  });

  it("retorna o mesmo prospecto no retry idempotente sem criar um segundo registro", async () => {
    const { service, prisma } = build();
    prisma.journeyProspect.findUnique.mockResolvedValueOnce(prospect);

    const result = await service.createProspect(createDto(), operator);

    expect(result.possibleDuplicates).toEqual([]);
    expect(result.prospect).toMatchObject({
      id: prospect.id,
      unitId: prospect.unitId,
      stage: prospect.stage,
      version: prospect.version,
    });
    expect(prisma.journeyProspect.create).not.toHaveBeenCalled();
  });

  it("rejeita intervalos inválidos e conteúdo fora da allowlist", async () => {
    const invalidRange = createDto({
      ageGroupMinMonths: 49,
      ageGroupMaxMonths: 48,
    });
    await expect(
      build().service.createProspect(invalidRange, operator),
    ).rejects.toThrow("Intervalo de faixa etária inválido");

    const sensitive = createDto({ source: "observação pedagógica" });
    await expect(
      build().service.createProspect(sensitive, operator),
    ).rejects.toThrow("somente dados de captação permitidos");
  });

  it("não permite que o criador publique sua própria política", async () => {
    const { service, prisma } = build();
    prisma.journeyWaitlistPolicyVersion.findFirst.mockResolvedValue({
      id: "policy-1",
      mantenedoraId: "tenant-a",
      unitId: "unit-a",
      createdBy: operator.sub,
      reviewedBy: "reviewer-1",
      status: JourneyWaitlistPolicyStatus.RASCUNHO,
    });
    await expect(
      service.publishPolicy(
        "policy-1",
        { idempotencyKey: "publish-001" },
        operator,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("exige revisor diferente do criador antes de marcar política revisada", async () => {
    const { service, prisma } = build();
    prisma.journeyWaitlistPolicyVersion.findFirst.mockResolvedValue({
      id: "policy-1",
      mantenedoraId: "tenant-a",
      unitId: "unit-a",
      createdBy: operator.sub,
    });
    await expect(
      service.reviewPolicy("policy-1", operator),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.journeyWaitlistPolicyVersion.update).not.toHaveBeenCalled();
  });

  it("rejeita aceite de oferta expirada sem criar Child, Enrollment ou draft", async () => {
    const { service, prisma } = build();
    const expiredOffer = {
      id: "offer-1",
      mantenedoraId: "tenant-a",
      unitId: "unit-a",
      prospectId: "prospect-1",
      classroomId: "class-a",
      status: JourneyOfferStatus.OFERTADA,
      reservationExpiresAt: new Date(Date.now() - 1000),
    };
    prisma.journeyEnrollmentDraft.findUnique.mockResolvedValue(null);
    prisma.journeySeatOffer.findFirst.mockResolvedValue(expiredOffer);
    prisma.journeySeatOffer.update.mockResolvedValue({
      ...expiredOffer,
      status: JourneyOfferStatus.EXPIRADA,
    });
    prisma.domainOutboxEvent.create.mockResolvedValue({ id: "outbox-expired" });

    await expect(
      service.decideOffer(
        "offer-1",
        { decision: "accept", idempotencyKey: "accept-expired-001" },
        operator,
      ),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.journeyEnrollmentDraft.create).not.toHaveBeenCalled();
    expect(prisma.child?.create).toBeUndefined();
    expect(prisma.enrollment?.create).toBeUndefined();
  });

  it("bloqueia duas visitas sobrepostas para o mesmo interessado", async () => {
    const { service, prisma } = build();
    prisma.journeyVisit.findUnique.mockResolvedValue(null);
    prisma.journeyVisit.findFirst.mockResolvedValue({ id: "visit-existing" });

    await expect(
      service.createVisit(
        {
          prospectId: "prospect-1",
          unitId: "unit-a",
          startsAt: "2026-08-30T10:00:00.000Z",
          endsAt: "2026-08-30T11:00:00.000Z",
          assignedTo: "operator-2",
          idempotencyKey: "visit-command-001",
        },
        operator,
      ),
    ).rejects.toThrow("Há outra visita no mesmo horário");

    expect(prisma.journeyVisit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ prospectId: "prospect-1" }),
      }),
    );
  });

  it("revalida capacidade no aceite e não cria draft quando outra reserva ocupou a vaga", async () => {
    const { service, prisma } = build();
    const offer = {
      id: "offer-1",
      mantenedoraId: "tenant-a",
      unitId: "unit-a",
      prospectId: "prospect-1",
      classroomId: "class-a",
      status: JourneyOfferStatus.OFERTADA,
      reservationExpiresAt: new Date(Date.now() + 60_000),
      overrideReason: null,
    };
    prisma.journeyEnrollmentDraft.findUnique.mockResolvedValue(null);
    prisma.journeySeatOffer.findFirst.mockResolvedValue(offer);
    prisma.enrollment.count.mockResolvedValue(0);
    prisma.journeySeatOffer.count.mockResolvedValue(1);

    await expect(
      service.decideOffer(
        "offer-1",
        { decision: "accept", idempotencyKey: "accept-capacity-001" },
        operator,
      ),
    ).rejects.toThrow("A capacidade foi ocupada antes do aceite");
    expect(prisma.journeyEnrollmentDraft.create).not.toHaveBeenCalled();
    expect(prisma.journeySeatOffer.update).not.toHaveBeenCalled();
  });
});
