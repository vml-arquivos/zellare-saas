import { ForbiddenException } from '@nestjs/common';
import { RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda1AccessService } from './onda1-access.service';
import { ONDA1_CAPABILITIES, ONDA1_FEATURE_FLAGS } from './onda1.constants';

function user(levels: RoleLevel[], overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'user@example.test',
    mantenedoraId: 'tenant-1',
    unitId: 'unit-1',
    roles: levels.map((level) => ({ level, type: level as unknown as RoleType, unitScopes: [] })),
    ...overrides,
  } as JwtPayload;
}

describe('Onda1AccessService', () => {
  const prisma = {
    tenantFeatureFlag: { findUnique: jest.fn() },
    childGuardian: { findFirst: jest.fn() },
  } as any;
  let service: Onda1AccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new Onda1AccessService(prisma);
  });

  it('usa todos os papéis, mesmo quando o primeiro não é o mais privilegiado', () => {
    const actor = user([RoleLevel.PROFESSOR, RoleLevel.UNIDADE]);
    expect(service.can(actor, ONDA1_CAPABILITIES.evidenceReview)).toBe(true);
    expect(service.can(actor, ONDA1_CAPABILITIES.familyPublish)).toBe(true);
  });

  it('permite contribuição somente para família', () => {
    expect(service.can(user([RoleLevel.FAMILIA]), ONDA1_CAPABILITIES.familyContribute)).toBe(true);
    expect(service.can(user([RoleLevel.PROFESSOR]), ONDA1_CAPABILITIES.familyContribute)).toBe(false);
  });

  it('mantém flags da Onda 1 desligadas quando não há linha no tenant', async () => {
    prisma.tenantFeatureFlag.findUnique.mockResolvedValue(null);
    await expect(service.isFlagEnabled(user([RoleLevel.DEVELOPER]), ONDA1_FEATURE_FLAGS.evidenceLoopV1)).resolves.toBe(false);
    await expect(service.assertFlagEnabled(user([RoleLevel.DEVELOPER]), ONDA1_FEATURE_FLAGS.reviewHubV1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('consulta a flag no escopo da mantenedora', async () => {
    prisma.tenantFeatureFlag.findUnique.mockResolvedValue({ enabled: true });
    await expect(service.isFlagEnabled(user([RoleLevel.DEVELOPER]), ONDA1_FEATURE_FLAGS.familyCircleV1)).resolves.toBe(true);
    expect(prisma.tenantFeatureFlag.findUnique).toHaveBeenCalledWith({
      where: { mantenedoraId_flagKey: { mantenedoraId: 'tenant-1', flagKey: ONDA1_FEATURE_FLAGS.familyCircleV1 } },
      select: { enabled: true },
    });
  });

  it('não autoriza vínculo familiar revogado ou fora da mantenedora', async () => {
    prisma.childGuardian.findFirst.mockResolvedValue(null);
    await expect(service.canViewFamilyChild(user([RoleLevel.FAMILIA]), 'child-1')).resolves.toBe(false);
    expect(prisma.childGuardian.findFirst).toHaveBeenCalledWith({
      where: {
        childId: 'child-1',
        userId: 'user-1',
        revokedAt: null,
        canViewTimeline: true,
        child: { mantenedoraId: 'tenant-1' },
      },
      select: { id: true },
    });
  });
});
