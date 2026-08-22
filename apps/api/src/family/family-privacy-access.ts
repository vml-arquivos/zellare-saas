import { RoleType } from "@prisma/client";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

export const FAMILY_PRIVACY_MANAGEMENT_KEY = "family_privacy_management";

const FAMILY_PRIVACY_MANAGEMENT_TYPES = new Set<RoleType>([
  RoleType.DEVELOPER,
  RoleType.MANTENEDORA_ADMIN,
  RoleType.UNIDADE_DIRETOR,
  RoleType.UNIDADE_ADMINISTRATIVO,
]);

export function canManageFamilyPrivacy(user: JwtPayload): boolean {
  return (
    user.roles?.some((role) =>
      FAMILY_PRIVACY_MANAGEMENT_TYPES.has(role.type),
    ) ?? false
  );
}
