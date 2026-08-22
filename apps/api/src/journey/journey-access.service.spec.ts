/* Mock parcial intencional nesta suíte unitária; o harness descartável cobre integração real. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleLevel, RoleType } from "@prisma/client";
import { JourneyAccessService } from "./journey-access.service";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

const role = (level: RoleLevel, type: RoleType, unitScopes: string[] = []) => ({
  roleId: `${level}-${type}`,
  level,
  type,
  unitScopes,
});

const user = (
  roles: ReturnType<typeof role>[],
  unitId: string | undefined = "unit-a",
): JwtPayload => ({
  sub: "user-1",
  email: "user@example.invalid",
  mantenedoraId: "tenant-a",
  unitId,
  roles,
});

function build(flagEnabled: boolean, unitRows = [{ id: "unit-a" }]) {
  const prisma: any = {
    tenantFeatureFlag: {
      findUnique: jest.fn().mockResolvedValue({ enabled: flagEnabled }),
    },
    unit: {
      findFirst: jest.fn().mockResolvedValue({ id: "unit-a" }),
      findMany: jest.fn().mockResolvedValue(unitRows),
    },
    journeyProspect: { findFirst: jest.fn() },
    classroom: { findFirst: jest.fn() },
  };
  return { prisma, access: new JourneyAccessService(prisma) };
}

describe("JourneyAccessService", () => {
  it("bloqueia a Journey quando a flag do tenant está desligada", async () => {
    const { access } = build(false);
    const allowed = user([
      role(RoleLevel.UNIDADE, RoleType.UNIDADE_ADMINISTRATIVO, ["unit-a"]),
    ]);
    await expect(
      access.assertAccess(allowed, "journey.read"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permite a matriz administrativa e de admissões, com capabilities granulares", () => {
    const { access } = build(true);
    const profiles = [
      user([
        role(RoleLevel.UNIDADE, RoleType.UNIDADE_ADMINISTRATIVO, ["unit-a"]),
      ]),
      user([role(RoleLevel.UNIDADE, RoleType.UNIDADE_DIRETOR, ["unit-a"])]),
      user([role(RoleLevel.STAFF_CENTRAL, RoleType.STAFF_CENTRAL_ADMISSOES)]),
      user([role(RoleLevel.MANTENEDORA, RoleType.MANTENEDORA_ADMIN)]),
      user([role(RoleLevel.DEVELOPER, RoleType.DEVELOPER)]),
    ];

    for (const profile of profiles) {
      expect(access.can(profile, "journey.read")).toBe(true);
      expect(access.can(profile, "journey.prospect.read")).toBe(true);
      expect(access.can(profile, "journey.prospect.manage")).toBe(true);
    }

    const centralAdmissions = profiles[2];
    expect(access.isNetworkScoped(centralAdmissions)).toBe(true);
    expect(access.can(centralAdmissions, "journey.offer.accept")).toBe(true);
    expect(access.can(centralAdmissions, "journey.privacy.manage")).toBe(false);
    expect(access.can(centralAdmissions, "journey.merge.review")).toBe(false);
  });

  it("não permite que coordenação pedagógica administre Journey, mesmo no nível amplo", () => {
    const { access } = build(true);
    const pedagogy = user([
      role(RoleLevel.UNIDADE, RoleType.UNIDADE_COORDENADOR_PEDAGOGICO, [
        "unit-a",
      ]),
    ]);
    const centralPedagogy = user(
      [role(RoleLevel.STAFF_CENTRAL, RoleType.STAFF_CENTRAL_PEDAGOGICO)],
      undefined,
    );

    expect(access.can(pedagogy, "journey.read")).toBe(false);
    expect(access.can(centralPedagogy, "journey.read")).toBe(false);
    expect(access.isNetworkScoped(centralPedagogy)).toBe(false);
  });

  it("nega psicologia, nutrição, professor, família e financeiro", () => {
    const { access } = build(true);
    const denied = [
      [RoleLevel.STAFF_CENTRAL, RoleType.STAFF_CENTRAL_PSICOLOGIA],
      [RoleLevel.UNIDADE, RoleType.UNIDADE_NUTRICIONISTA],
      [RoleLevel.PROFESSOR, RoleType.PROFESSOR],
      [RoleLevel.FAMILIA, RoleType.FAMILIA_RESPONSAVEL],
      [RoleLevel.MANTENEDORA, RoleType.MANTENEDORA_FINANCEIRO],
    ] as const;

    for (const [level, type] of denied) {
      expect(access.can(user([role(level, type)]), "journey.read")).toBe(false);
    }
  });

  it("permite administrativo somente na unidade autorizada e não vaza outra unidade", async () => {
    const { access, prisma } = build(true);
    const allowed = user([
      role(RoleLevel.UNIDADE, RoleType.UNIDADE_ADMINISTRATIVO, ["unit-a"]),
    ]);
    await expect(
      access.assertUnitAccess(allowed, "unit-a"),
    ).resolves.toBeUndefined();
    prisma.unit.findFirst.mockResolvedValueOnce(null);
    await expect(
      access.assertUnitAccess(allowed, "unit-b"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("permite que admissões central liste todas as unidades da mesma mantenedora", async () => {
    const { access } = build(true, [{ id: "unit-a" }, { id: "unit-b" }]);
    const central = user(
      [role(RoleLevel.STAFF_CENTRAL, RoleType.STAFF_CENTRAL_ADMISSOES)],
      undefined,
    );
    await expect(access.accessibleUnitIds(central)).resolves.toEqual([
      "unit-a",
      "unit-b",
    ]);
  });
});
