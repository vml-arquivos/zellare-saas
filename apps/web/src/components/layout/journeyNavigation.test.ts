import { describe, expect, it } from "vitest";
import type { User } from "../../api/auth";
import { getNavigationGroups } from "./navigationManifest";

const journeyCapabilities = [
  "journey.read",
  "journey.prospect.read",
  "journey.visit.read",
  "journey.waitlist.read",
  "journey.offer.read",
];

function profile(
  level: string,
  type: string,
  featureFlags: string[] = [],
  capabilities?: string[],
): User {
  return {
    id: `${level}-${type}`,
    email: "synthetic@example.invalid",
    mantenedoraId: "synthetic-org",
    roles: [{ roleId: "role-1", level, type, unitScopes: ["unit-a"] }],
    featureFlags,
    capabilities,
  };
}

describe("Journey navigation gate", () => {
  it("mantém Journey oculta quando a flag do tenant está ausente", () => {
    const groups = getNavigationGroups(
      profile("UNIDADE", "UNIDADE_ADMINISTRATIVO", [], journeyCapabilities),
    );
    expect(groups.some((group) => group.id === "journey")).toBe(false);
  });

  it("exibe Journey para administrativo de unidade quando flag e capabilities estão ativas", () => {
    const groups = getNavigationGroups(
      profile(
        "UNIDADE",
        "UNIDADE_ADMINISTRATIVO",
        ["journey_admissions_v1"],
        journeyCapabilities,
      ),
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

  it("exibe Journey para admissões central e não para capability ausente", () => {
    expect(
      getNavigationGroups(
        profile(
          "STAFF_CENTRAL",
          "STAFF_CENTRAL_ADMISSOES",
          ["journey_admissions_v1"],
          journeyCapabilities,
        ),
      ).some((group) => group.id === "journey"),
    ).toBe(true);

    expect(
      getNavigationGroups(
        profile(
          "STAFF_CENTRAL",
          "STAFF_CENTRAL_ADMISSOES",
          ["journey_admissions_v1"],
          ["journey.read"],
        ),
      )
        .filter((group) => group.id === "journey")
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toEqual(["journey-overview", "journey-reports"]);
  });

  it("não expõe Journey a pedagogia, psicologia ou nutrição", () => {
    const denied = [
      ["UNIDADE", "UNIDADE_COORDENADOR_PEDAGOGICO"],
      ["STAFF_CENTRAL", "STAFF_CENTRAL_PEDAGOGICO"],
      ["STAFF_CENTRAL", "STAFF_CENTRAL_PSICOLOGIA"],
      ["UNIDADE", "UNIDADE_NUTRICIONISTA"],
    ];
    for (const [level, type] of denied) {
      expect(
        getNavigationGroups(
          profile(level, type, ["journey_admissions_v1"], journeyCapabilities),
        ).some((group) => group.id === "journey"),
      ).toBe(false);
    }
  });
});
