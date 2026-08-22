import { Onda2RatioState } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2CoverageService } from './onda2-coverage.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};

describe('Onda2CoverageService', () => {
  const prisma = {
    ratioPolicy: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    ratioSnapshot: { create: jest.fn(), findMany: jest.fn() },
    ratioBreach: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    staffingAssignment: { findUnique: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    facilitySpace: { findFirst: jest.fn() },
    operationalPresenceEvent: { findMany: jest.fn() },
    $transaction: jest.fn((operation: any) => operation(prisma)),
  } as any;
  const access = {
    assertFlagAndCapability: jest.fn(),
    assertUnitAccess: jest.fn(),
  } as any;
  let service: Onda2CoverageService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagAndCapability.mockResolvedValue(undefined);
    access.assertUnitAccess.mockResolvedValue(undefined);
    service = new Onda2CoverageService(prisma, access);
  });

  it('cria snapshot determinístico e abre breach quando faltam adultos', async () => {
    prisma.facilitySpace.findFirst.mockResolvedValue({ id: 'space-1', capacity: 20 });
    prisma.operationalPresenceEvent.findMany.mockResolvedValue([
      ...Array.from({ length: 12 }, (_, index) => ({ subjectType: 'CHILD', subjectId: `child-${index + 1}`, eventType: 'CHECK_IN', occurredAt: new Date('2026-08-21T08:00:00.000Z') })),
      { subjectType: 'STAFF', subjectId: 'adult-1', eventType: 'CHECK_IN', occurredAt: new Date('2026-08-21T08:01:00.000Z') },
    ]);
    prisma.ratioPolicy.findFirst.mockResolvedValue({ id: 'policy-1', version: 1, definition: { maxChildrenPerAdult: 6, minimumAdults: 0 } });
    prisma.ratioSnapshot.create.mockResolvedValue({ id: 'snapshot-1', state: Onda2RatioState.VIOLATION });
    prisma.ratioBreach.findFirst.mockResolvedValue(null);
    prisma.ratioBreach.create.mockResolvedValue({ id: 'breach-1' });

    await expect(
      service.createSnapshot(
        { unitId: 'unit-1', spaceId: 'space-1', snapshotAt: '2026-08-21T12:00:00.000Z', policyId: 'policy-1' },
        actor,
      ),
    ).resolves.toEqual({ id: 'snapshot-1', state: Onda2RatioState.VIOLATION });

    expect(prisma.ratioSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ childCount: 12, requiredAdults: 2, validAdults: 1, state: Onda2RatioState.VIOLATION, inputSnapshot: expect.objectContaining({ source: 'operational_presence_event', eventCount: 13, diagnosticInference: false, humanReviewRequired: true }) }) }),
    );
    expect(prisma.ratioBreach.create).toHaveBeenCalled();
  });
});
