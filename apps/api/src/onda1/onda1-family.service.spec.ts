import { ForbiddenException } from '@nestjs/common';
import { EvidenceSensitivity, Onda1MessagePriority, RoleLevel, RoleType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ONDA1_FEATURE_FLAGS } from './onda1.constants';
import { Onda1FamilyService } from './onda1-family.service';

function user(levels: RoleLevel[], overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'family@example.test',
    mantenedoraId: 'tenant-1',
    unitId: 'unit-1',
    roles: levels.map((level) => ({ level, type: level as unknown as RoleType, unitScopes: [] })),
    ...overrides,
  } as JwtPayload;
}

describe('Onda1FamilyService', () => {
  const prisma = {
    tenantFeatureFlag: { findUnique: jest.fn() },
    child: { findFirst: jest.fn() },
    classroomTeacher: { findFirst: jest.fn() },
    childGuardian: { findFirst: jest.fn() },
    familyConversation: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    familyMessageV2: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    familyContribution: { findMany: jest.fn(), create: jest.fn() },
    childGoal: { findFirst: jest.fn() },
    childEvidence: { findFirst: jest.fn() },
    consentGrant: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    publicationRecord: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    acknowledgment: { upsert: jest.fn() },
    communicationPreference: { findUnique: jest.fn(), upsert: jest.fn() },
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
  } as any;
  const audit = { log: jest.fn() } as any;
  let service: Onda1FamilyService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagEnabled.mockResolvedValue(undefined);
    access.assertCapability.mockReturnValue(undefined);
    access.isNetworkScoped.mockReturnValue(false);
    access.isCentralScoped.mockReturnValue(false);
    access.isTeacher.mockReturnValue(false);
    access.canViewFamilyChild.mockResolvedValue(true);
    audit.log.mockResolvedValue(undefined);
    service = new Onda1FamilyService(prisma, access, audit);
  });

  it('mantém o Family Circle fechado quando a flag está desligada', async () => {
    access.assertFlagEnabled.mockRejectedValueOnce(new ForbiddenException('flag off'));
    await expect(service.feed('child-1', { limit: 30 } as any, user([RoleLevel.FAMILIA]))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.child.findFirst).not.toHaveBeenCalled();
  });

  it('retorna a mesma mensagem para retry com clientMutationId já persistido', async () => {
    const actor = user([RoleLevel.FAMILIA]);
    prisma.familyConversation.findFirst.mockResolvedValue({ id: 'conversation-1', childId: 'child-1', mantenedoraId: 'tenant-1', unitId: 'unit-1', status: 'ABERTA' });
    prisma.child.findFirst.mockResolvedValue({ id: 'child-1', unitId: 'unit-1', firstName: 'Ana', lastName: 'Lima', enrollments: [] });
    prisma.familyMessageV2.findFirst.mockResolvedValue({ id: 'message-1', conversationId: 'conversation-1', clientMutationId: 'mutation-1' });

    await expect(service.createMessage('conversation-1', { body: 'Mensagem', clientMutationId: 'mutation-1', priority: Onda1MessagePriority.NORMAL }, actor)).resolves.toEqual(
      expect.objectContaining({ id: 'message-1' }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('impede publicação para família quando não existe consentimento concedido e vigente', async () => {
    const actor = user([RoleLevel.UNIDADE]);
    prisma.child.findFirst.mockResolvedValue({ id: 'child-1', unitId: 'unit-1', firstName: 'Ana', lastName: 'Lima', enrollments: [] });
    prisma.consentGrant.findFirst.mockResolvedValue(null);

    await expect(
      service.createPublication(
        {
          childId: 'child-1',
          sourceType: 'CHILD_EVIDENCE',
          sourceId: 'evidence-1',
          audienceType: 'FAMILIA',
          snapshot: { text: 'registro' },
          sensitivity: EvidenceSensitivity.ORDINARIA,
        } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.publicationRecord.create).not.toHaveBeenCalled();
  });
});
