import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleLevel } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ONDA1_CAPABILITIES, ONDA1_FEATURE_FLAGS, type Onda1Capability, type Onda1FeatureFlagKey } from './onda1.constants';

const NETWORK_LEVELS = new Set<RoleLevel>([RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA]);
const CENTRAL_LEVELS = new Set<RoleLevel>([RoleLevel.DEVELOPER, RoleLevel.MANTENEDORA, RoleLevel.STAFF_CENTRAL]);
const UNIT_LEVELS = new Set<RoleLevel>([RoleLevel.UNIDADE]);
const PROFESSOR_LEVELS = new Set<RoleLevel>([RoleLevel.PROFESSOR]);

@Injectable()
export class Onda1AccessService {
  constructor(private readonly prisma: PrismaService) {}

  levels(user: JwtPayload): RoleLevel[] {
    return Array.from(new Set((user.roles ?? []).map((role) => role.level)));
  }

  hasAnyLevel(user: JwtPayload, levels: RoleLevel[]): boolean {
    const actual = new Set(this.levels(user));
    return levels.some((level) => actual.has(level));
  }

  can(user: JwtPayload, capability: Onda1Capability): boolean {
    const levels = new Set(this.levels(user));
    const has = (level: RoleLevel) => levels.has(level);
    const isFamily = has(RoleLevel.FAMILIA);
    const isTeacher = has(RoleLevel.PROFESSOR);
    const isUnit = has(RoleLevel.UNIDADE);
    const isCentral = Array.from(CENTRAL_LEVELS).some((level) => levels.has(level));

    switch (capability) {
      case ONDA1_CAPABILITIES.evidenceCapture:
        return isTeacher || isUnit || isCentral;
      case ONDA1_CAPABILITIES.evidenceReview:
        return isUnit || isCentral;
      case ONDA1_CAPABILITIES.evidenceViewSensitive:
        return isCentral || isUnit;
      case ONDA1_CAPABILITIES.goalManage:
        return isTeacher || isUnit || isCentral;
      case ONDA1_CAPABILITIES.familyPublish:
        return isUnit || isCentral;
      case ONDA1_CAPABILITIES.familyMessage:
        return isFamily || isTeacher || isUnit || isCentral;
      case ONDA1_CAPABILITIES.familyContribute:
        return isFamily;
      case ONDA1_CAPABILITIES.consentManage:
        return isFamily || isUnit || isCentral;
      case ONDA1_CAPABILITIES.operationsViewUrgency:
        return isTeacher || isUnit || isCentral;
      case ONDA1_CAPABILITIES.analyticsViewAggregate:
        return isUnit || isCentral;
      default:
        return false;
    }
  }

  assertCapability(user: JwtPayload, capability: Onda1Capability): void {
    if (!this.can(user, capability)) {
      throw new ForbiddenException(`Capacidade ausente: ${capability}`);
    }
  }

  async isFlagEnabled(user: JwtPayload, flagKey: Onda1FeatureFlagKey): Promise<boolean> {
    const flag = await this.prisma.tenantFeatureFlag.findUnique({
      where: { mantenedoraId_flagKey: { mantenedoraId: user.mantenedoraId, flagKey } },
      select: { enabled: true },
    });
    return flag?.enabled === true;
  }

  async assertFlagEnabled(user: JwtPayload, flagKey: Onda1FeatureFlagKey): Promise<void> {
    if (!(await this.isFlagEnabled(user, flagKey))) {
      throw new ForbiddenException(`Recurso temporariamente indisponível: ${flagKey}`);
    }
  }

  isNetworkScoped(user: JwtPayload): boolean {
    return this.hasAnyLevel(user, Array.from(NETWORK_LEVELS));
  }

  isCentralScoped(user: JwtPayload): boolean {
    return this.hasAnyLevel(user, Array.from(CENTRAL_LEVELS));
  }

  isUnitScoped(user: JwtPayload): boolean {
    return this.hasAnyLevel(user, Array.from(UNIT_LEVELS));
  }

  isTeacher(user: JwtPayload): boolean {
    return this.hasAnyLevel(user, Array.from(PROFESSOR_LEVELS));
  }

  canViewFamilyChild(user: JwtPayload, childId: string): Promise<boolean> {
    return this.prisma.childGuardian
      .findFirst({
        where: { childId, userId: user.sub, revokedAt: null, canViewTimeline: true, child: { mantenedoraId: user.mantenedoraId } },
        select: { id: true },
      })
      .then(Boolean);
  }
}
