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
]);

const JOURNEY_ALLOWED_TYPES = new Set<RoleType>([
  RoleType.DEVELOPER,
  RoleType.MANTENEDORA_ADMIN,
  RoleType.STAFF_CENTRAL_ADMISSOES,
  RoleType.UNIDADE_DIRETOR,
  RoleType.UNIDADE_ADMINISTRATIVO,
]);

const READ_CAPABILITIES = new Set<JourneyCapability>([
  JOURNEY_CAPABILITIES.read,
  JOURNEY_CAPABILITIES.prospectRead,
  JOURNEY_CAPABILITIES.visitRead,
  JOURNEY_CAPABILITIES.waitlistRead,
  JOURNEY_CAPABILITIES.offerRead,
]);

const WRITE_CAPABILITIES = new Set<JourneyCapability>([
  JOURNEY_CAPABILITIES.manage,
  JOURNEY_CAPABILITIES.prospectManage,
  JOURNEY_CAPABILITIES.visitManage,
  JOURNEY_CAPABILITIES.manageWaitlist,
  JOURNEY_CAPABILITIES.offerSeat,
  JOURNEY_CAPABILITIES.acceptOffer,
  JOURNEY_CAPABILITIES.reviewMerge,
  JOURNEY_CAPABILITIES.privacyManage,
]);

@Injectable()
export class JourneyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private roles(user: JwtPayload) {
    return (user.roles ?? []).filter((role) =>
      JOURNEY_ALLOWED_TYPES.has(role.type),
    );
  }

  private levels(user: JwtPayload): Set<RoleLevel> {
    return new Set(this.roles(user).map((role) => role.level));
  }

  private types(user: JwtPayload): Set<RoleType> {
    return new Set(this.roles(user).map((role) => role.type));
  }

  isNetworkScoped(user: JwtPayload): boolean {
    return this.roles(user).some(
      (role) =>
        NETWORK_LEVELS.has(role.level) ||
        (role.level === RoleLevel.STAFF_CENTRAL &&
          role.type === RoleType.STAFF_CENTRAL_ADMISSOES),
    );
  }

  can(user: JwtPayload, capability: JourneyCapability): boolean {
    const types = this.types(user);
    const developer = types.has(RoleType.DEVELOPER);
    const mantenedoraAdmin = types.has(RoleType.MANTENEDORA_ADMIN);
    const director = types.has(RoleType.UNIDADE_DIRETOR);
    const centralAdmissions = types.has(RoleType.STAFF_CENTRAL_ADMISSOES);
    const administrative = types.has(RoleType.UNIDADE_ADMINISTRATIVO);
    const unitAdmissions = administrative || director || centralAdmissions;
    const readable =
      developer || mantenedoraAdmin || centralAdmissions || unitAdmissions;
    const writable =
      developer || mantenedoraAdmin || centralAdmissions || unitAdmissions;

    if (capability === JOURNEY_CAPABILITIES.overrideCapacity)
      return developer || director;
    if (capability === JOURNEY_CAPABILITIES.reviewMerge)
      return developer || mantenedoraAdmin || director;
    if (capability === JOURNEY_CAPABILITIES.acceptOffer)
      return developer || mantenedoraAdmin || director;
    if (capability === JOURNEY_CAPABILITIES.offerSeat)
      return developer || mantenedoraAdmin || unitAdmissions;
    if (capability === JOURNEY_CAPABILITIES.manageWaitlist)
      return developer || mantenedoraAdmin || unitAdmissions;
    if (capability === JOURNEY_CAPABILITIES.visitManage)
      return developer || mantenedoraAdmin || unitAdmissions;
    if (capability === JOURNEY_CAPABILITIES.prospectManage)
      return developer || mantenedoraAdmin || unitAdmissions;
    if (capability === JOURNEY_CAPABILITIES.privacyManage)
      return developer || mantenedoraAdmin || director;
    if (WRITE_CAPABILITIES.has(capability)) return writable;
    if (READ_CAPABILITIES.has(capability)) return readable;
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
      this.roles(user).some((role) => role.unitScopes.includes(unitId))
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
    for (const role of this.roles(user)) {
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
        consentContact: true,
        privacyStatus: true,
        retentionUntil: true,
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
