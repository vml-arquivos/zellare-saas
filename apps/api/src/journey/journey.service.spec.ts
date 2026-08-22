/* O mock Prisma é deliberadamente parcial nesta suíte unitária; integração real é coberta pelo harness descartável. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { ConflictException, GoneException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import {
  JourneyOfferStatus,
  JourneyStage,
  JourneyWaitlistPolicyStatus,
  Onda1LegalBasis,
  RoleLevel,
  RoleType,
  UserStatus,
} from "@prisma/client";
import { JourneyService } from "./journey.service";
import { JourneyAccessService } from "./journey-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

process.env.JWT_SECRET ??= "journey-unit-test-secret-2026";
process.env.JOURNEY_CONTACT_HMAC_SECRET ??= "journey-unit-test-hmac-2026";
process.env.JOURNEY_CONTACT_ENCRYPTION_SECRET ??=
  "journey-unit-test-encryption-2026";

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
  emailCiphertext: null,
  phoneCiphertext: null,
  privacyStatus: "ACTIVE",
  retentionUntil: null,
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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    journeyProspectStageEvent: { findUnique: jest.fn(), create: jest.fn() },
    journeyProspectPrivacyEvent: { findUnique: jest.fn(), create: jest.fn() },
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
    journeyEnrollmentDraft: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
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
    captureLegalBasis: Onda1LegalBasis.CONSENT,
    contactLegalBasis: Onda1LegalBasis.CONSENT,
    idempotencyKey: "prospect-command-001",
    ...overrides,
  };
}

describe("JourneyService", () => {
  it("detecta duplicidade por organização, cria revisão humana e não retorna hashes", async () => {
    const { service, prisma } = build();
    const emailHash = `hmac-sha256-v1:${createHmac(
      "sha256",
      process.env.JOURNEY_CONTACT_HMAC_SECRET as string,
    )
      .update("family@example.invalid")
      .digest("hex")}`;
    prisma.journeyProspect.findUnique.mockResolvedValueOnce(null);
    prisma.journeyProspect.findMany.mockResolvedValueOnce([
      {
        ...prospect,
        emailHash,
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
    expect(prisma.journeyProspect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
          phone: null,
          emailHash: expect.stringMatching(/^hmac-sha256-v1:/),
          emailCiphertext: expect.stringMatching(/^aes-256-gcm-v1:/),
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

  it("rejeita contato sem base legal de consentimento", async () => {
    await expect(
      build().service.createProspect(
        createDto({ contactLegalBasis: undefined }),
        operator,
      ),
    ).rejects.toThrow("Contato exige consentimento explícito");
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

  it("bloqueia mutações sobre prospecto expirado", async () => {
    const { service, access } = build();
    access.assertProspectAccess.mockResolvedValueOnce({
      ...prospect,
      retentionUntil: new Date(Date.now() - 1_000),
    });
    await expect(
      service.createActivity(
        "prospect-1",
        { type: "NOTA", title: "Retorno", idempotencyKey: "activity-expired" },
        operator,
      ),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it("rejeita transição que não consta da máquina de estados", async () => {
    const { service } = build();
    await expect(
      service.changeStage(
        "prospect-1",
        {
          toStage: JourneyStage.ACEITO,
          idempotencyKey: "stage-invalid",
        },
        operator,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("elimina prospecto logicamente, preservando o evento de privacidade", async () => {
    const { service, prisma } = build();
    prisma.journeyProspectPrivacyEvent.findUnique.mockResolvedValue(null);
    prisma.journeyProspect.findUnique.mockResolvedValue(prospect);
    prisma.journeyProspect.update.mockResolvedValue({
      ...prospect,
      privacyStatus: "ERASED",
      erasedAt: new Date(),
    });
    prisma.journeyProspectPrivacyEvent.create.mockResolvedValue({
      id: "privacy-1",
    });
    prisma.domainOutboxEvent.create.mockResolvedValue({
      id: "outbox-privacy-1",
    });

    const result = await service.eraseProspect(
      "prospect-1",
      { reason: "Solicitação de teste", idempotencyKey: "erase-001" },
      operator,
    );

    expect(result.status).toBe("ERASED");
    expect(prisma.journeyProspect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responsibleName: "[REMOVIDO]",
          email: null,
          phone: null,
          emailHash: null,
          phoneHash: null,
          privacyStatus: "ERASED",
        }),
      }),
    );
    expect(prisma.journeyProspectPrivacyEvent.create).toHaveBeenCalledTimes(1);
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
      prospect: { privacyStatus: "ACTIVE", retentionUntil: null },
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
      prospect: { privacyStatus: "ACTIVE", retentionUntil: null },
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
