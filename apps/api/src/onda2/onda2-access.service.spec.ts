import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ONDA2_CAPABILITIES, ONDA2_FEATURE_FLAGS } from './onda2.constants';
import { Onda2AccessService } from './onda2-access.service';

function user(levels: RoleLevel[], overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'user@example.test',
    mantenedoraId: 'tenant-1',
    unitId: 'unit-1',
    roles: levels.map((level) => ({
      level,
      type:
        level === RoleLevel.PROFESSOR
          ? RoleType.PROFESSOR
          : level === RoleLevel.UNIDADE
            ? RoleType.UNIDADE_DIRETOR
            : level === RoleLevel.MANTENEDORA
              ? RoleType.MANTENEDORA_ADMIN
              : level === RoleLevel.STAFF_CENTRAL
                ? RoleType.STAFF_CENTRAL_PEDAGOGICO
                : RoleType.DEVELOPER,
      unitScopes: [],
    })),
    ...overrides,
  } as JwtPayload;
}

describe('Onda2AccessService', () => {
  const prisma = {
    tenantFeatureFlag: { findUnique: jest.fn() },
    unit: { findFirst: jest.fn() },
    child: { findFirst: jest.fn() },
  } as any;
  let service: Onda2AccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new Onda2AccessService(prisma);
  });

  it('usa todos os papéis e não depende da posição do primeiro papel', () => {
    const actor = user([RoleLevel.PROFESSOR, RoleLevel.UNIDADE]);
    expect(service.can(actor, ONDA2_CAPABILITIES.presenceRecord)).toBe(true);
    expect(service.can(actor, ONDA2_CAPABILITIES.facilityRequestTriage)).toBe(true);
  });

  it('permite leitura de rede somente a papéis de rede', () => {
    expect(service.can(user([RoleLevel.MANTENEDORA]), ONDA2_CAPABILITIES.pulseReadNetwork)).toBe(true);
    expect(service.can(user([RoleLevel.UNIDADE]), ONDA2_CAPABILITIES.pulseReadNetwork)).toBe(false);
    expect(service.can(user([RoleLevel.PROFESSOR]), ONDA2_CAPABILITIES.pulseReadNetwork)).toBe(false);
  });

  it('mantém flag desligada quando não existe linha no tenant', async () => {
    prisma.tenantFeatureFlag.findUnique.mockResolvedValue(null);
    await expect(service.isFlagEnabled(user([RoleLevel.DEVELOPER]), ONDA2_FEATURE_FLAGS.pulseCommandCenterV1)).resolves.toBe(false);
    await expect(service.assertFlagEnabled(user([RoleLevel.DEVELOPER]), ONDA2_FEATURE_FLAGS.ratioEngineV1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('consulta a flag no escopo da mantenedora', async () => {
    prisma.tenantFeatureFlag.findUnique.mockResolvedValue({ enabled: true });
    await expect(service.isFlagEnabled(user([RoleLevel.DEVELOPER]), ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1)).resolves.toBe(true);
    expect(prisma.tenantFeatureFlag.findUnique).toHaveBeenCalledWith({
      where: { mantenedoraId_flagKey: { mantenedoraId: 'tenant-1', flagKey: ONDA2_FEATURE_FLAGS.facilitiesServiceDeskV1 } },
      select: { enabled: true },
    });
  });

  it('não libera unidade de outra mantenedora para papel de rede', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);
    await expect(service.assertUnitAccess(user([RoleLevel.MANTENEDORA]), 'unit-other')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.unit.findFirst).toHaveBeenCalledWith({
      where: { id: 'unit-other', mantenedoraId: 'tenant-1' },
      select: { id: true },
    });
  });

  it('respeita unitScopes para papéis locais', async () => {
    const actor = user([RoleLevel.UNIDADE], {
      unitId: undefined,
      roles: [{ roleId: 'role-unit', level: RoleLevel.UNIDADE, type: RoleType.UNIDADE_DIRETOR, unitScopes: ['unit-2'] }],
    });
    await expect(service.canAccessUnit(actor, 'unit-2')).resolves.toBe(true);
    await expect(service.canAccessUnit(actor, 'unit-3')).resolves.toBe(false);
  });

  it('retorna NotFound para criança fora do escopo autorizado', async () => {
    prisma.child.findFirst.mockResolvedValue(null);
    await expect(service.assertChildAccess(user([RoleLevel.UNIDADE]), 'child-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.child.findFirst).toHaveBeenCalled();
  });
});
