import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  ONDA2_CAPABILITIES,
  ONDA2_FEATURE_FLAGS,
  type Onda2Capability,
  type Onda2FeatureFlagKey,
} from './onda2.constants';

const NETWORK_LEVELS = new Set<RoleLevel>([RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL]);
const UNIT_LEVELS = new Set<RoleLevel>([RoleLevel.UNIDADE]);
const TEACHER_LEVELS = new Set<RoleLevel>([RoleLevel.PROFESSOR]);

@Injectable()
export class Onda2AccessService {
  constructor(private readonly prisma: PrismaService) {}

  levels(user: JwtPayload): Set<RoleLevel> {
    return new Set((user.roles ?? []).map((role) => role.level));
  }

  types(user: JwtPayload): Set<RoleType> {
    return new Set((user.roles ?? []).map((role) => role.type));
  }

  isNetworkScoped(user: JwtPayload): boolean {
    return Array.from(NETWORK_LEVELS).some((level) => this.levels(user).has(level));
  }

  isCentralScoped(user: JwtPayload): boolean {
    const levels = this.levels(user);
    return levels.has(RoleLevel.DEVELOPER) || levels.has(RoleLevel.MANTENEDORA) || levels.has(RoleLevel.STAFF_CENTRAL);
  }

  isUnitScoped(user: JwtPayload): boolean {
    return Array.from(UNIT_LEVELS).some((level) => this.levels(user).has(level));
  }

  isTeacher(user: JwtPayload): boolean {
    return Array.from(TEACHER_LEVELS).some((level) => this.levels(user).has(level));
  }

  hasType(user: JwtPayload, type: RoleType): boolean {
    return this.types(user).has(type);
  }

  can(user: JwtPayload, capability: Onda2Capability): boolean {
    const levels = this.levels(user);
    const isNetwork = Array.from(NETWORK_LEVELS).some((level) => levels.has(level));
    const isUnit = levels.has(RoleLevel.UNIDADE);
    const isTeacher = levels.has(RoleLevel.PROFESSOR);
    const isOperationalUnit = isUnit && [
      RoleType.UNIDADE_DIRETOR,
      RoleType.UNIDADE_ADMINISTRATIVO,
      RoleType.UNIDADE_COORDENADOR_PEDAGOGICO,
      RoleType.UNIDADE_NUTRICIONISTA,
    ].some((type) => this.types(user).has(type));

    switch (capability) {
      case ONDA2_CAPABILITIES.pulseReadNetwork:
        return isNetwork;
      case ONDA2_CAPABILITIES.pulseReadUnit:
      case ONDA2_CAPABILITIES.pulseReadRoom:
        return isNetwork || isUnit || isTeacher;
      case ONDA2_CAPABILITIES.presenceRecord:
      case ONDA2_CAPABILITIES.facilityRequestCreate:
        return isNetwork || isUnit || isTeacher;
      case ONDA2_CAPABILITIES.presenceCorrect:
      case ONDA2_CAPABILITIES.staffingManage:
      case ONDA2_CAPABILITIES.staffingPublish:
      case ONDA2_CAPABILITIES.ratioPolicyManage:
      case ONDA2_CAPABILITIES.ratioPolicyReview:
      case ONDA2_CAPABILITIES.ratioPolicyPublish:
      case ONDA2_CAPABILITIES.facilityRequestTriage:
      case ONDA2_CAPABILITIES.assetManage:
      case ONDA2_CAPABILITIES.preventiveManage:
      case ONDA2_CAPABILITIES.inspectionManage:
      case ONDA2_CAPABILITIES.correctiveVerify:
        return isNetwork || isOperationalUnit;
      case ONDA2_CAPABILITIES.ratioPolicyRead:
      case ONDA2_CAPABILITIES.ratioBreachAcknowledge:
      case ONDA2_CAPABILITIES.ratioBreachResolve:
        return isNetwork || isUnit;
      case ONDA2_CAPABILITIES.workorderRead:
      case ONDA2_CAPABILITIES.workorderAssign:
      case ONDA2_CAPABILITIES.workorderExecute:
      case ONDA2_CAPABILITIES.workorderValidate:
      case ONDA2_CAPABILITIES.workorderReopen:
      case ONDA2_CAPABILITIES.assetRead:
      case ONDA2_CAPABILITIES.inspectionExecute:
      case ONDA2_CAPABILITIES.facilityCostRead:
      case ONDA2_CAPABILITIES.facilityProcurementDraft:
        return isNetwork || isUnit;
      case ONDA2_CAPABILITIES.operationalAiUse:
      case ONDA2_CAPABILITIES.operationalAiReview:
        return isNetwork || isOperationalUnit;
      default:
        return false;
    }
  }

  assertCapability(user: JwtPayload, capability: Onda2Capability): void {
    if (!this.can(user, capability)) {
      throw new ForbiddenException(`Capacidade ausente: ${capability}`);
    }
  }

  async isFlagEnabled(user: JwtPayload, flagKey: Onda2FeatureFlagKey): Promise<boolean> {
    const row = await this.prisma.tenantFeatureFlag.findUnique({
      where: { mantenedoraId_flagKey: { mantenedoraId: user.mantenedoraId, flagKey } },
      select: { enabled: true },
    });
    return row?.enabled === true;
  }

  async assertFlagEnabled(user: JwtPayload, flagKey: Onda2FeatureFlagKey): Promise<void> {
    if (!(await this.isFlagEnabled(user, flagKey))) {
      throw new ForbiddenException(`Recurso temporariamente indisponível: ${flagKey}`);
    }
  }

  async canAccessUnit(user: JwtPayload, unitId: string): Promise<boolean> {
    if (this.isNetworkScoped(user)) {
      return Boolean(await this.prisma.unit.findFirst({ where: { id: unitId, mantenedoraId: user.mantenedoraId }, select: { id: true } }));
    }

    return (user.roles ?? []).some((role) => role.unitScopes.includes(unitId)) || user.unitId === unitId;
  }

  async assertUnitAccess(user: JwtPayload, unitId: string): Promise<void> {
    if (!(await this.canAccessUnit(user, unitId))) {
      throw new NotFoundException('Unidade não encontrada no escopo autorizado');
    }
  }

  async assertChildAccess(user: JwtPayload, childId: string): Promise<{ id: string; unitId: string; mantenedoraId: string }> {
    const child = await this.prisma.child.findFirst({
      where: {
        id: childId,
        mantenedoraId: user.mantenedoraId,
        OR: this.isNetworkScoped(user)
          ? undefined
          : [
              { unitId: user.unitId ?? '__none__' },
              { unit: { userRoleUnitScopes: { some: { userRole: { userId: user.sub, isActive: true } } } } },
              { guardianLinks: { some: { userId: user.sub, revokedAt: null } } },
            ],
      },
      select: { id: true, unitId: true, mantenedoraId: true },
    });
    if (!child) throw new NotFoundException('Registro não encontrado no escopo autorizado');
    return child;
  }

  async assertFlagAndCapability(user: JwtPayload, flagKey: Onda2FeatureFlagKey, capability: Onda2Capability): Promise<void> {
    this.assertCapability(user, capability);
    await this.assertFlagEnabled(user, flagKey);
  }

  defaultFlags(): Record<Onda2FeatureFlagKey, false> {
    return {
      [ONDA2_FEATURE_FLAGS.pulseCommandCenterV1]: false,
      [ONDA2_FEATURE_FLAGS.ratioEngineV1]: false,
      [ONDA2_FEATURE_FLAGS.staffingCoverageV1]: false,
      [ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1]: false,
      [ONDA2_FEATURE_FLAGS.preventiveMaintenanceV1]: false,
      [ONDA2_FEATURE_FLAGS.complianceInspectionsV1]: false,
      [ONDA2_FEATURE_FLAGS.operationalAiV1]: false,
    };
  }
}
