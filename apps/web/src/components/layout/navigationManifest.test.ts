import { describe, expect, it } from "vitest";
import type { User } from "../../api/auth";
import {
  getActiveNavigationGroupId,
  getNavigationGroups,
  navigationItemMatchesPath,
} from "./navigationManifest";

const user = (
  level: string,
  type: string,
  unitId = "unit-a",
  capabilities?: string[],
): User => ({
  id: `${level.toLowerCase()}-1`,
  email: `${level.toLowerCase()}@example.invalid`,
  mantenedoraId: "org-a",
  unitId,
  roles: [{ roleId: `${type}-role`, level, type, unitScopes: [] }],
  capabilities,
});

function itemIds(profile: User) {
  return getNavigationGroups(profile).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

describe("navigation manifest", () => {
  it("mantém professor no seu fluxo e não expõe gestão de vínculos", () => {
    const ids = itemIds(user("PROFESSOR", "PROFESSOR"));
    expect(ids).toContain("teacher-plan-create");
    expect(ids).toContain("family-attendances");
    expect(ids).not.toContain("family-links");
    expect(ids).not.toContain("units");
  });

  it("expõe vínculo familiar para administrativo, mas não para coordenação pedagógica", () => {
    const adminIds = itemIds(user("UNIDADE", "UNIDADE_ADMINISTRATIVO"));
    expect(adminIds).toContain("family-links");

    const coordinatorIds = itemIds(
      user("UNIDADE", "UNIDADE_COORDENADOR_PEDAGOGICO"),
    );
    expect(coordinatorIds).toContain("review");
    expect(coordinatorIds).not.toContain("family-links");
    expect(coordinatorIds).not.toContain("teacher-plan-create");
  });

  it("mantém coordenação central na rede sem expor gestão Family/LGPD", () => {
    const ids = itemIds(user("STAFF_CENTRAL", "STAFF_CENTRAL_PEDAGOGICO"));
    expect(ids).toContain("central-dashboard");
    expect(ids).toContain("general-coordination");
    expect(ids).not.toContain("family-links");
  });

  it("dá suporte completo ao desenvolvedor sem depender de listas paralelas", () => {
    const groups = getNavigationGroups(user("DEVELOPER", "DEVELOPER"));
    expect(groups.map((group) => group.id)).toEqual([
      "overview",
      "pedagogy",
      "care",
      "family",
      "materials",
      "administration",
      "operations",
    ]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(61);
  });

  it("faz matching de rotas aninhadas e queries específicas sem confundir itens irmãos", () => {
    expect(
      navigationItemMatchesPath(
        "/app/planejamentos/123",
        "",
        "/app/planejamentos",
      ),
    ).toBe(true);
    expect(
      navigationItemMatchesPath(
        "/app/nutricionista",
        "?s=pedidos",
        "/app/nutricionista?s=pedidos",
      ),
    ).toBe(true);
    expect(
      navigationItemMatchesPath(
        "/app/nutricionista",
        "?s=cardapios",
        "/app/nutricionista?s=pedidos",
      ),
    ).toBe(false);
  });

  it("identifica o grupo da rota ativa", () => {
    const groups = getNavigationGroups(
      user("UNIDADE", "UNIDADE_ADMINISTRATIVO"),
    );
    expect(
      getActiveNavigationGroupId(groups, "/app/familia/vinculos", ""),
    ).toBe("family");
    expect(getActiveNavigationGroupId(groups, "/app/configuracoes", "")).toBe(
      "administration",
    );
  });
});
