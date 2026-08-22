import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoleLevel, RoleType } from "@prisma/client";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import {
  JOURNEY_CAPABILITIES,
  JOURNEY_FEATURE_FLAGS,
  type JourneyCapability,
} from "./journey.constants";

const NETWORK_LEVELS = new Set<RoleLevel>([
  RoleLevel.DEVELOPER,
  RoleLevel.MANTENEDORA,
  RoleLevel.STAFF_CENTRAL,
]);

const CENTRAL_ALLOWED_TYPES = new Set<RoleType>([
  RoleType.DEVELOPER,
  RoleType.MANTENEDORA_ADMIN,
  RoleType.STAFF_CENTRAL_PEDAGOGICO,
]);

const UNIT_ALLOWED_TYPES = new Set<RoleType>([
  RoleType.UNIDADE_DIRETOR,
  RoleType.UNIDADE_COORDENADOR_PEDAGOGICO,
  RoleType.UNIDADE_ADMINISTRATIVO,
]);

@Injectable()
export class JourneyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private levels(user: JwtPayload): Set<RoleLevel> {
    return new Set((user.roles ?? []).map((role) => role.level));
  }

  private types(user: JwtPayload): Set<RoleType> {
    return new Set((user.roles ?? []).map((role) => role.type));
  }

  isNetworkScoped(user: JwtPayload): boolean {
    return Array.from(NETWORK_LEVELS).some((level) =>
      this.levels(user).has(level),
    );
  }

  can(user: JwtPayload, capability: JourneyCapability): boolean {
    const levels = this.levels(user);
    const types = this.types(user);
    const developer =
      levels.has(RoleLevel.DEVELOPER) || types.has(RoleType.DEVELOPER);
    const central =
      (levels.has(RoleLevel.MANTENEDORA) &&
        Array.from(types).some((type) => CENTRAL_ALLOWED_TYPES.has(type))) ||
      (levels.has(RoleLevel.STAFF_CENTRAL) &&
        Array.from(types).some((type) => CENTRAL_ALLOWED_TYPES.has(type)));
    const unit =
      levels.has(RoleLevel.UNIDADE) &&
      Array.from(types).some((type) => UNIT_ALLOWED_TYPES.has(type));

    if (capability === JOURNEY_CAPABILITIES.read)
      return developer || central || unit;
    if (capability === JOURNEY_CAPABILITIES.manage)
      return developer || central || unit;
    if (capability === JOURNEY_CAPABILITIES.reviewMerge)
      return developer || central || unit;
    if (capability === JOURNEY_CAPABILITIES.manageWaitlist)
      return developer || central || unit;
    if (capability === JOURNEY_CAPABILITIES.offerSeat)
      return developer || central || unit;
    if (capability === JOURNEY_CAPABILITIES.acceptOffer)
      return developer || central || unit;
    if (capability === JOURNEY_CAPABILITIES.overrideCapacity)
      return developer || central;
    return false;
  }

  assertCapability(user: JwtPayload, capability: JourneyCapability): void {
    if (!this.can(user, capability)) {
      throw new ForbiddenException(`Capacidade Journey ausente: ${capability}`);
    }
  }

  async assertEnabled(user: JwtPayload): Promise<void> {
    const flag = await this.prisma.tenantFeatureFlag.findUnique({
      where: {
        mantenedoraId_flagKey: {
          mantenedoraId: user.mantenedoraId,
          flagKey: JOURNEY_FEATURE_FLAGS.admissionsV1,
        },
      },
      select: { enabled: true },
    });
    if (flag?.enabled !== true) {
      throw new ForbiddenException(
        "Jornada e Admissões está temporariamente indisponível",
      );
    }
  }

  async assertAccess(
    user: JwtPayload,
    capability: JourneyCapability,
  ): Promise<void> {
    this.assertCapability(user, capability);
    await this.assertEnabled(user);
  }

  async canAccessUnit(user: JwtPayload, unitId: string): Promise<boolean> {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, mantenedoraId: user.mantenedoraId, isActive: true },
      select: { id: true },
    });
    if (!unit) return false;
    if (this.isNetworkScoped(user)) return true;
    return (
      user.unitId === unitId ||
      (user.roles ?? []).some((role) => role.unitScopes.includes(unitId))
    );
  }

  async assertUnitAccess(user: JwtPayload, unitId: string): Promise<void> {
    if (!(await this.canAccessUnit(user, unitId))) {
      throw new NotFoundException(
        "Unidade não encontrada no escopo autorizado",
      );
    }
  }

  async accessibleUnitIds(
    user: JwtPayload,
    requestedUnitId?: string,
  ): Promise<string[]> {
    if (requestedUnitId) {
      await this.assertUnitAccess(user, requestedUnitId);
      return [requestedUnitId];
    }
    if (this.isNetworkScoped(user)) {
      const units = await this.prisma.unit.findMany({
        where: { mantenedoraId: user.mantenedoraId, isActive: true },
        select: { id: true },
        orderBy: { name: "asc" },
      });
      return units.map((unit) => unit.id);
    }
    const ids = new Set<string>();
    if (user.unitId) ids.add(user.unitId);
    for (const role of user.roles ?? []) {
      for (const unitId of role.unitScopes) ids.add(unitId);
    }
    const units = await this.prisma.unit.findMany({
      where: {
        mantenedoraId: user.mantenedoraId,
        isActive: true,
        id: { in: [...ids] },
      },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return units.map((unit) => unit.id);
  }

  async assertProspectAccess(user: JwtPayload, prospectId: string) {
    const prospect = await this.prisma.journeyProspect.findFirst({
      where: { id: prospectId, mantenedoraId: user.mantenedoraId },
      select: {
        id: true,
        unitId: true,
        mantenedoraId: true,
        stage: true,
        period: true,
        ageGroupMinMonths: true,
        ageGroupMaxMonths: true,
        desiredDate: true,
      },
    });
    if (!prospect)
      throw new NotFoundException(
        "Interessado não encontrado no escopo autorizado",
      );
    await this.assertUnitAccess(user, prospect.unitId);
    return prospect;
  }

  async assertClassroomAccess(
    user: JwtPayload,
    classroomId: string,
    unitId: string,
  ) {
    const classroom = await this.prisma.classroom.findFirst({
      where: {
        id: classroomId,
        unitId,
        unit: { mantenedoraId: user.mantenedoraId, isActive: true },
      },
      select: {
        id: true,
        unitId: true,
        capacity: true,
        ageGroupMin: true,
        ageGroupMax: true,
        isActive: true,
      },
    });
    if (!classroom)
      throw new NotFoundException("Turma não encontrada no escopo autorizado");
    await this.assertUnitAccess(user, unitId);
    if (!classroom.isActive)
      throw new ForbiddenException("A turma está inativa");
    return classroom;
  }
}
