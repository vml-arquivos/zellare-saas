import { RoleLevel, RoleType } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { JourneyCapabilityGuard } from "./journey-capability.guard";
import { FamilyPrivacyGuard } from "../family/family-privacy.guard";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import type { JourneyCapability } from "./journey.constants";
import type { JourneyAccessService } from "./journey-access.service";

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

function context(user?: JwtPayload): ExecutionContext {
  const request = { user };
  const http = {
    getRequest: <TRequest extends object>() => request as TRequest,
  };
  return {
    getHandler: () => context,
    getClass: () => Object,
    switchToHttp: () => http,
  } as unknown as ExecutionContext;
}

describe("endpoint authorization guards", () => {
  it("aplica a capability Journey declarada pelo endpoint", () => {
    const getAllAndOverride = jest
      .fn()
      .mockReturnValue("journey.prospect.manage");
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const can = jest.fn().mockReturnValue(true);
    const access = { can } as unknown as JourneyAccessService;
    const guard = new JourneyCapabilityGuard(reflector, access);

    expect(guard.canActivate(context(operator))).toBe(true);
    expect(can).toHaveBeenCalledWith(operator, "journey.prospect.manage");
  });

  it("nega Journey sem capability ou sem usuário e permite endpoint sem metadata", () => {
    const getAllAndOverride = jest
      .fn()
      .mockReturnValueOnce("journey.privacy.manage" satisfies JourneyCapability)
      .mockReturnValueOnce(undefined);
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const can = jest.fn().mockReturnValue(false);
    const access = { can } as unknown as JourneyAccessService;
    const guard = new JourneyCapabilityGuard(reflector, access);

    expect(guard.canActivate(context(operator))).toBe(false);
    expect(guard.canActivate(context())).toBe(true);
    expect(can).toHaveBeenCalledTimes(1);
  });

  it("restringe Family/LGPD a perfis administrativos autorizados", () => {
    const guard = new FamilyPrivacyGuard();
    expect(guard.canActivate(context(operator))).toBe(true);
    expect(
      guard.canActivate(
        context({
          ...operator,
          roles: [
            {
              roleId: "role-pedagogy",
              level: RoleLevel.UNIDADE,
              type: RoleType.UNIDADE_COORDENADOR_PEDAGOGICO,
              unitScopes: ["unit-a"],
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(guard.canActivate(context())).toBe(false);
  });
});
