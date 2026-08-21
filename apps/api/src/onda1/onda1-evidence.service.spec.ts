import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Onda1GoalType, Onda1ReviewPriority, Onda1ReviewTaskStatus, RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda1EvidenceService } from './onda1-evidence.service';
import { ONDA1_FEATURE_FLAGS } from './onda1.constants';

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

describe('Onda1EvidenceService', () => {
  const prisma = {
    tenantFeatureFlag: { findUnique: jest.fn() },
    child: { findFirst: jest.fn() },
    classroomTeacher: { findFirst: jest.fn() },
    childEvidence: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    evidenceReviewTask: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    childGoal: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    supportAction: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    evidenceLink: { upsert: jest.fn() },
    alertaOperacional: { findMany: jest.fn() },
    publicationRecord: { findMany: jest.fn() },
    familyContribution: { findMany: jest.fn() },
    domainOutboxEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  } as any;
  const access = {
    assertFlagEnabled: jest.fn(),
    assertCapability: jest.fn(),
    isNetworkScoped: jest.fn(),
    isCentralScoped: jest.fn(),
    isTeacher: jest.fn(),
    canViewFamilyChild: jest.fn(),
    can: jest.fn(),
  } as any;
  const evidence = { crossAnalysis: jest.fn() } as any;
  const audit = { log: jest.fn() } as any;
  let service: Onda1EvidenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagEnabled.mockImplementation(async (_user: JwtPayload, flag: string) => {
      if (flag === ONDA1_FEATURE_FLAGS.evidenceLoopV1 || flag === ONDA1_FEATURE_FLAGS.reviewHubV1) return;
    });
    access.isNetworkScoped.mockReturnValue(false);
    access.isCentralScoped.mockReturnValue(false);
    access.isTeacher.mockReturnValue(false);
    access.canViewFamilyChild.mockResolvedValue(false);
    access.can.mockReturnValue(false);
    evidence.crossAnalysis.mockResolvedValue({ longitudinal: [] });
    audit.log.mockResolvedValue(undefined);
    service = new Onda1EvidenceService(prisma, access, evidence, audit);
  });

  it('bloqueia Child 360 quando a feature flag está desligada', async () => {
    access.assertFlagEnabled.mockRejectedValueOnce(new ForbiddenException('flag off'));
    await expect(service.child360('child-1', { limit: 30 } as any, user([RoleLevel.PROFESSOR]))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.child.findFirst).not.toHaveBeenCalled();
  });

  it('bloqueia Review Hub quando a capability está ausente', async () => {
    access.assertCapability.mockImplementationOnce(() => {
      throw new ForbiddenException('capability missing');
    });
    await expect(service.reviewQueue({ limit: 30 } as any, user([RoleLevel.PROFESSOR]))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.evidenceReviewTask.findMany).not.toHaveBeenCalled();
  });

  it('não cria revisão para evidência fora do escopo da criança', async () => {
    prisma.childEvidence.findFirst.mockResolvedValue({ id: 'evidence-1', childId: 'child-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', isActive: true });
    prisma.child.findFirst.mockResolvedValue(null);
    await expect(service.createReviewTask('evidence-1', { priority: Onda1ReviewPriority.NORMAL } as any, user([RoleLevel.UNIDADE]))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita atualização com versão otimista incorreta', async () => {
    prisma.evidenceReviewTask.findFirst.mockResolvedValue({ id: 'task-1', childId: 'child-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', version: 3, status: Onda1ReviewTaskStatus.OPEN });
    prisma.child.findFirst.mockResolvedValue({ id: 'child-1', unitId: 'unit-1', enrollments: [] });
    await expect(
      service.updateReviewTask('task-1', { status: Onda1ReviewTaskStatus.IN_REVIEW, expectedVersion: 2 } as any, user([RoleLevel.UNIDADE])),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita transição de revisão inválida', async () => {
    prisma.evidenceReviewTask.findFirst.mockResolvedValue({ id: 'task-1', childId: 'child-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', version: 1, status: Onda1ReviewTaskStatus.APPROVED });
    prisma.child.findFirst.mockResolvedValue({ id: 'child-1', unitId: 'unit-1', enrollments: [] });
    await expect(
      service.updateReviewTask('task-1', { status: Onda1ReviewTaskStatus.OPEN, expectedVersion: 1 } as any, user([RoleLevel.UNIDADE])),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloqueia objetivo quando a criança está em outra unidade', async () => {
    prisma.child.findFirst.mockResolvedValue({ id: 'child-1', unitId: 'unit-2', enrollments: [] });
    await expect(
      service.createGoal(
        'child-1',
        { goalType: Onda1GoalType.PEDAGOGICO, title: 'Objetivo', startDate: '2026-08-21T00:00:00.000Z' } as any,
        user([RoleLevel.PROFESSOR]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.childGoal.create).not.toHaveBeenCalled();
  });
});
