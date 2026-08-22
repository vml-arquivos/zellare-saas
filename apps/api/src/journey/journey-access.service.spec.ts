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
  it("blocks every capability when the tenant flag is off", async () => {
    const { access } = build(false);
    const allowed = user([
      role(RoleLevel.UNIDADE, RoleType.UNIDADE_COORDENADOR_PEDAGOGICO),
    ]);
    await expect(
      access.assertAccess(allowed, "journey.read"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows unit administration only for its own unit", async () => {
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

  it("allows network pedagogy to list authorized tenant units", async () => {
    const { access } = build(true, [{ id: "unit-a" }, { id: "unit-b" }]);
    const central = user(
      [role(RoleLevel.STAFF_CENTRAL, RoleType.STAFF_CENTRAL_PEDAGOGICO)],
      undefined,
    );
    await expect(access.accessibleUnitIds(central)).resolves.toEqual([
      "unit-a",
      "unit-b",
    ]);
  });

  it("denies psychology and nutrition even if their level is broad enough", () => {
    const { access } = build(true);
    expect(
      access.can(
        user([
          role(RoleLevel.STAFF_CENTRAL, RoleType.STAFF_CENTRAL_PSICOLOGIA),
        ]),
        "journey.read",
      ),
    ).toBe(false);
    expect(
      access.can(
        user([role(RoleLevel.UNIDADE, RoleType.UNIDADE_NUTRICIONISTA)]),
        "journey.read",
      ),
    ).toBe(false);
  });
});
