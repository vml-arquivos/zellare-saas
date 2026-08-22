import { Onda2PresenceEventType } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2PulseService } from './onda2-pulse.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};

describe('Onda2PulseService', () => {
  const prisma = {
    operationalPresenceSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    operationalPresenceEvent: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    unit: { findMany: jest.fn() },
    ratioBreach: { count: jest.fn() },
    maintenanceRequest: { count: jest.fn() },
    workOrder: { count: jest.fn() },
  } as any;
  const access = {
    assertFlagAndCapability: jest.fn(),
    assertUnitAccess: jest.fn(),
    isNetworkScoped: jest.fn(),
  } as any;
  let service: Onda2PulseService;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertFlagAndCapability.mockResolvedValue(undefined);
    access.assertUnitAccess.mockResolvedValue(undefined);
    service = new Onda2PulseService(prisma, access);
  });

  it('registra evento idempotente e persiste a origem do dispositivo', async () => {
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue(null);
    prisma.operationalPresenceEvent.create.mockResolvedValue({ id: 'event-1', status: 'ACCEPTED' });

    await expect(
      service.recordEvent(
        {
          unitId: 'unit-1',
          subjectType: 'CHILD',
          subjectId: 'child-1',
          eventType: Onda2PresenceEventType.CHECK_IN,
          occurredAt: '2026-08-21T12:00:00.000Z',
          idempotencyKey: 'mobile-1',
          source: 'MOBILE',
          payload: { room: 'sala-1' },
        },
        actor,
      ),
    ).resolves.toEqual({ id: 'event-1', status: 'ACCEPTED' });

    expect(prisma.operationalPresenceEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ mantenedoraId: 'tenant-1', source: 'MOBILE', idempotencyKey: 'mobile-1' }) }),
    );
    expect(prisma.operationalPresenceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'mobile-1', source: 'MOBILE', createdBy: 'user-1' }) }),
    );
  });

  it('retorna o mesmo evento quando a chave idempotente já existe', async () => {
    const existing = { id: 'event-existing', unitId: 'unit-1', idempotencyKey: 'same-key' };
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue(existing);
    await expect(
      service.recordEvent(
        { unitId: 'unit-1', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_OUT, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'same-key' },
        actor,
      ),
    ).resolves.toBe(existing);
    expect(prisma.operationalPresenceEvent.create).not.toHaveBeenCalled();
  });
});
