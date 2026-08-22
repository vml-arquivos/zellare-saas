import { describe, expect, it } from "vitest";
import type { User } from "../../api/auth";
import { getNavigationGroups } from "./navigationManifest";

function profile(
  level: string,
  type: string,
  featureFlags: string[] = [],
): User {
  return {
    id: `${level}-${type}`,
    email: "synthetic@example.invalid",
    mantenedoraId: "synthetic-org",
    roles: [{ roleId: "role-1", level, type, unitScopes: ["unit-a"] }],
    featureFlags,
  };
}

describe("Journey navigation gate", () => {
  it("keeps Journey hidden when the tenant flag is absent", () => {
    const groups = getNavigationGroups(
      profile("UNIDADE", "UNIDADE_COORDENADOR_PEDAGOGICO"),
    );
    expect(groups.some((group) => group.id === "journey")).toBe(false);
  });

  it("shows Journey only for an allowed role when the persisted flag is active", () => {
    const groups = getNavigationGroups(
      profile("UNIDADE", "UNIDADE_COORDENADOR_PEDAGOGICO", [
        "journey_admissions_v1",
      ]),
    );
    expect(
      groups
        .find((group) => group.id === "journey")
        ?.items.map((item) => item.id),
    ).toEqual([
      "journey-overview",
      "journey-prospects",
      "journey-pipeline",
      "journey-visits",
      "journey-waitlist",
      "journey-offers",
      "journey-reports",
    ]);
  });

  it("does not expose Journey to psychology or nutrition even when their level passes the broad route guard", () => {
    expect(
      getNavigationGroups(
        profile("STAFF_CENTRAL", "STAFF_CENTRAL_PSICOLOGIA", [
          "journey_admissions_v1",
        ]),
      ).some((group) => group.id === "journey"),
    ).toBe(false);
    expect(
      getNavigationGroups(
        profile("UNIDADE", "UNIDADE_NUTRICIONISTA", ["journey_admissions_v1"]),
      ).some((group) => group.id === "journey"),
    ).toBe(false);
  });
});
