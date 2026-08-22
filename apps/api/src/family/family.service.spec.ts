import {
  Onda1ConsentDecision,
  Onda1LegalBasis,
  Prisma,
  RoleLevel,
  RoleType,
} from "@prisma/client";
import { FamilyService } from "./family.service";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import type {
  FamilyChildrenQueryDto,
  FamilyGuardianCandidatesQueryDto,
} from "./dto/family.dto";

function familyUser(): JwtPayload {
  return {
    sub: "guardian-1",
    email: "family@example.invalid",
    mantenedoraId: "mantenedora-1",
    unitId: "unit-1",
    roles: [
      {
        roleId: "family-role",
        level: RoleLevel.FAMILIA,
        type: RoleType.FAMILIA_RESPONSAVEL,
        unitScopes: [],
      },
    ],
  };
}

function staffUser(): JwtPayload {
  return {
    sub: "staff-1",
    email: "staff@example.invalid",
    mantenedoraId: "mantenedora-1",
    unitId: undefined,
    roles: [
      {
        roleId: "staff-role",
        level: RoleLevel.STAFF_CENTRAL,
        type: RoleType.STAFF_CENTRAL_PEDAGOGICO,
        unitScopes: ["unit-1"],
      },
    ],
  };
}

function unitUser(): JwtPayload {
  return {
    sub: "unit-1-user",
    email: "unit@example.invalid",
    mantenedoraId: "mantenedora-1",
    unitId: "unit-1",
    roles: [
      {
        roleId: "unit-role",
        level: RoleLevel.UNIDADE,
        type: RoleType.UNIDADE_ADMINISTRATIVO,
        unitScopes: [],
      },
    ],
  };
}

function mockPromise(): jest.Mock<Promise<unknown>, unknown[]> {
  return jest.fn<Promise<unknown>, unknown[]>();
}

function partial<T extends Record<string, unknown>>(value: T): T {
  return expect.objectContaining(value) as unknown as T;
}

function anyValue<T>(constructor: abstract new (...args: never[]) => T): T {
  return expect.any(constructor) as unknown as T;
}

function makePrisma(canViewDevelopment: boolean) {
  const child = {
    id: "child-1",
    firstName: "Ana",
    lastName: "Silva",
    photoUrl: null,
    unitId: "unit-1",
    mantenedoraId: "mantenedora-1",
  };
  return {
    child: {
      findFirst: mockPromise().mockResolvedValue(child),
      count: mockPromise(),
      findMany: mockPromise(),
    },
    childGuardian: {
      findFirst: mockPromise().mockResolvedValue({
        childId: "child-1",
        userId: "guardian-1",
        revokedAt: null,
        canViewTimeline: true,
        canViewDevelopment,
      }),
      findUnique: mockPromise(),
      findMany: mockPromise(),
      updateMany: mockPromise(),
      upsert: mockPromise(),
    },
    diaryEvent: { findMany: mockPromise().mockResolvedValue([]) },
    studentPostPerformance: { findMany: mockPromise().mockResolvedValue([]) },
    developmentObservation: {
      findMany: mockPromise().mockResolvedValue(
        canViewDevelopment
          ? [
              {
                id: "observation-1",
                category: "GERAL",
                date: new Date("2026-08-01T12:00:00.000Z"),
                learningProgress: "Evolução observada",
                socialInteraction: null,
                emotionalState: null,
                recommendations: null,
              },
            ]
          : [],
      ),
    },
    familyCommunication: {
      findMany: mockPromise().mockResolvedValue([]),
      create: mockPromise(),
    },
    unit: { findFirst: mockPromise().mockResolvedValue({ id: "unit-1" }) },
    classroom: {
      findFirst: mockPromise().mockResolvedValue({
        id: "class-1",
        unitId: "unit-1",
      }),
    },
    user: {
      findFirst: mockPromise(),
      count: mockPromise(),
      findMany: mockPromise(),
    },
    auditLog: {
      create: mockPromise(),
      findMany: mockPromise().mockResolvedValue([]),
    },
    consentGrant: { create: mockPromise() },
  };
}

type CrudPrisma = ReturnType<typeof makePrisma> & {
  $transaction: PrismaService["$transaction"];
};

function makeCrudPrisma(): CrudPrisma {
  const base = makePrisma(true);
  const tx = {
    childGuardian: base.childGuardian,
    auditLog: base.auditLog,
    consentGrant: base.consentGrant,
  } as unknown as Prisma.TransactionClient;
  const transaction = jest.fn(
    (
      operation:
        | ((client: Prisma.TransactionClient) => Promise<unknown>)
        | Promise<unknown>[],
    ) =>
      typeof operation === "function" ? operation(tx) : Promise.all(operation),
  );
  return {
    ...base,
    $transaction: transaction as unknown as PrismaService["$transaction"],
  };
}

describe("FamilyService — privacy timeline", () => {
  it("não consulta nem expõe observações sem permissão de desenvolvimento", async () => {
    const prisma = makePrisma(false);
    const service = new FamilyService(prisma as unknown as PrismaService);
    const result = await service.timeline("child-1", {}, familyUser());
    expect(prisma.developmentObservation.findMany).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.privacy).toMatchObject({
      familyDataFiltered: true,
      healthDataVisible: false,
      developmentVisible: false,
    });
  });

  it("inclui observações filtradas quando o responsável possui consentimento explícito", async () => {
    const prisma = makePrisma(true);
    const service = new FamilyService(prisma as unknown as PrismaService);
    const result = await service.timeline("child-1", {}, familyUser());
    expect(prisma.developmentObservation.findMany).toHaveBeenCalledTimes(1);
    expect(result.privacy).toMatchObject({
      developmentVisible: true,
      healthDataVisible: false,
    });
    expect(result.items).toEqual([
      partial({
        kind: "OBSERVACAO",
        title: "Observação · GERAL",
      }),
    ]);
  });
});

describe("FamilyService — Gate UX 0.4", () => {
  it("aplica filtros server-side e retorna matrícula ativa e paginação", async () => {
    const prisma = makeCrudPrisma();
    prisma.child.count.mockResolvedValue(21);
    prisma.child.findMany.mockResolvedValue([
      {
        id: "child-1",
        firstName: "Ana",
        lastName: "Silva",
        photoUrl: null,
        unitId: "unit-1",
        unit: { id: "unit-1", name: "Unidade A", code: "A" },
        enrollments: [
          {
            id: "enroll-1",
            enrollmentDate: new Date("2026-02-01"),
            classroom: {
              id: "class-1",
              name: "Maternal A",
              code: "MA",
              unitId: "unit-1",
            },
          },
        ],
      },
    ]);
    const service = new FamilyService(prisma as unknown as PrismaService);
    const result = await service.listChildren(unitUser(), {
      unitId: "unit-1",
      classroomId: "class-1",
      search: "Ana",
      page: 2,
      limit: 10,
      sortBy: "firstName",
      sortOrder: "asc",
    } as FamilyChildrenQueryDto);
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      hasNext: true,
    });
    expect(result.items[0]).toMatchObject({
      unit: { code: "A" },
      activeEnrollment: { classroom: { id: "class-1" } },
    });
    expect(prisma.classroom.findFirst).toHaveBeenCalledWith(
      partial({
        where: partial({ id: "class-1" }),
      }),
    );
  });

  it("lista somente contas familiares ativas e elegíveis com paginação", async () => {
    const prisma = makeCrudPrisma();
    prisma.user.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([
      {
        id: "guardian-2",
        firstName: "Bruno",
        lastName: "Silva",
        email: "bruno@example.invalid",
        phone: null,
        status: "ATIVO",
        unit: { id: "unit-1", name: "Unidade A", code: "A" },
      },
    ]);
    const service = new FamilyService(prisma as unknown as PrismaService);
    const result = await service.listGuardianCandidates(unitUser(), {
      unitId: "unit-1",
      search: "bruno",
      page: 1,
      limit: 1,
    } as FamilyGuardianCandidatesQueryDto);
    expect(result.items).toHaveLength(1);
    expect(result.pagination).toMatchObject({
      total: 2,
      totalPages: 2,
      hasNext: true,
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      partial({
        where: partial({ status: "ATIVO", unitId: "unit-1" }),
      }),
    );
  });

  it("registra consentimentos, evita duplicidade e audita ator/data no vínculo", async () => {
    const prisma = makeCrudPrisma();
    prisma.user.findFirst.mockResolvedValue({
      id: "guardian-2",
      firstName: "Bruno",
      lastName: "Silva",
      email: "bruno@example.invalid",
      phone: null,
      status: "ATIVO",
    });
    prisma.childGuardian.findUnique.mockResolvedValue({ id: "link-old" });
    prisma.childGuardian.upsert.mockResolvedValue({
      id: "link-1",
      childId: "child-1",
      userId: "guardian-2",
      relationship: "Pai",
      isPrimary: true,
      canViewTimeline: true,
      canViewDevelopment: true,
      canViewHealth: false,
      user: { id: "guardian-2" },
    });
    const service = new FamilyService(prisma as unknown as PrismaService);
    const result = await service.linkGuardian(
      "child-1",
      {
        userId: "guardian-2",
        relationship: "Pai",
        isPrimary: true,
        canViewTimeline: true,
        canViewDevelopment: true,
        canViewHealth: false,
        legalBasis: Onda1LegalBasis.CONSENT,
        consentPolicyVersion: "family-link-v1",
        retentionUntil: "2027-08-01T00:00:00.000Z",
      },
      unitUser(),
    );
    expect(result).toMatchObject({
      isPrimary: true,
      canViewDevelopment: true,
      canViewHealth: false,
    });
    expect(prisma.childGuardian.upsert).toHaveBeenCalledWith(
      partial({
        where: { childId_userId: { childId: "child-1", userId: "guardian-2" } },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      partial({
        data: partial({
          userId: "unit-1-user",
          action: "UPDATE",
          entityId: "child-1",
        }),
      }),
    );
    expect(prisma.consentGrant.create).toHaveBeenCalledWith(
      partial({
        data: partial({
          legalBasis: Onda1LegalBasis.CONSENT,
          decision: Onda1ConsentDecision.CONCEDIDO,
          validUntil: anyValue(Date),
        }),
      }),
    );
  });

  it("bloqueia coordenação pedagógica no gerenciamento de vínculos", async () => {
    const prisma = makeCrudPrisma();
    const service = new FamilyService(prisma as unknown as PrismaService);
    await expect(
      service.linkGuardian(
        "child-1",
        { userId: "guardian-2", relationship: "Pai" },
        staffUser(),
      ),
    ).rejects.toThrow("Somente administrativo");
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita base legal diferente de consentimento e retenção inválida", async () => {
    const service = new FamilyService(
      makeCrudPrisma() as unknown as PrismaService,
    );
    await expect(
      service.linkGuardian(
        "child-1",
        {
          userId: "guardian-2",
          relationship: "Pai",
          legalBasis: Onda1LegalBasis.LEGAL_OBLIGATION,
        },
        unitUser(),
      ),
    ).rejects.toThrow("consentimento como base legal");
    await expect(
      service.linkGuardian(
        "child-1",
        {
          userId: "guardian-2",
          relationship: "Pai",
          retentionUntil: "2020-01-01T00:00:00.000Z",
        },
        unitUser(),
      ),
    ).rejects.toThrow("Prazo de retenção familiar inválido");
  });

  it("revoga imediatamente permissões e registra auditoria", async () => {
    const prisma = makeCrudPrisma();
    prisma.childGuardian.updateMany.mockResolvedValue({ count: 1 });
    const service = new FamilyService(prisma as unknown as PrismaService);
    await service.revokeGuardian(
      "child-1",
      "guardian-2",
      { reason: "Solicitação de teste" },
      unitUser(),
    );
    expect(prisma.childGuardian.updateMany).toHaveBeenCalledWith(
      partial({
        data: partial({
          revokedAt: anyValue(Date),
          canViewTimeline: false,
          canViewDevelopment: false,
          canViewHealth: false,
          revocationReason: "Solicitação de teste",
        }),
      }),
    );
    expect(prisma.consentGrant.create).toHaveBeenCalledWith(
      partial({
        data: partial({
          decision: Onda1ConsentDecision.REVOGADO,
          legalBasis: Onda1LegalBasis.CONSENT,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
