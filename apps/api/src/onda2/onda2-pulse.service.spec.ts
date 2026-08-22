import { ConflictException, NotFoundException } from '@nestjs/common';
import { Onda2PresenceEventType, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Onda2PulseService } from './onda2-pulse.service';

const actor: JwtPayload = {
  sub: 'user-1',
  email: 'user-1@test.local',
  mantenedoraId: 'tenant-1',
  unitId: 'unit-1',
  roles: [{ roleId: 'role-1', level: 'UNIDADE' as any, type: 'UNIDADE_DIRETOR' as any, unitScopes: [] }],
};
const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });

describe('Onda2PulseService', () => {
  const prisma = {
    operationalPresenceSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    operationalPresenceEvent: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    facilitySpace: { findFirst: jest.fn() },
    unit: { findMany: jest.fn() },
    ratioBreach: { count: jest.fn() },
    maintenanceRequest: { count: jest.fn() },
    workOrder: { count: jest.fn() },
  } as any;
  const access = { assertFlagAndCapability: jest.fn(), assertUnitAccess: jest.fn(), isNetworkScoped: jest.fn() } as any;
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
    await expect(service.recordEvent({ unitId: 'unit-1', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_IN, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'mobile-1', source: 'MOBILE', payload: { synthetic: true } }, actor)).resolves.toEqual({ id: 'event-1', status: 'ACCEPTED' });
    expect(prisma.operationalPresenceEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ mantenedoraId: 'tenant-1', source: 'MOBILE', idempotencyKey: 'mobile-1' }) }));
    expect(prisma.operationalPresenceEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'mobile-1', source: 'MOBILE', createdBy: 'user-1' }) }));
  });

  it('retorna o mesmo evento quando a chave idempotente já existe na mesma unidade', async () => {
    const existing = { id: 'event-existing', unitId: 'unit-1', idempotencyKey: 'same-key' };
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue(existing);
    await expect(service.recordEvent({ unitId: 'unit-1', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_OUT, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'same-key' }, actor)).resolves.toBe(existing);
    expect(prisma.operationalPresenceEvent.create).not.toHaveBeenCalled();
  });

  it('rejeita chave idempotente encontrada em outra unidade', async () => {
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue({ id: 'event-other-unit', unitId: 'unit-2', idempotencyKey: 'same-key' });
    await expect(service.recordEvent({ unitId: 'unit-1', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_IN, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'same-key' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.operationalPresenceEvent.create).not.toHaveBeenCalled();
  });

  it('rejeita espaço pertencente a outra unidade', async () => {
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue(null);
    prisma.facilitySpace.findFirst.mockResolvedValue(null);
    await expect(service.recordEvent({ unitId: 'unit-1', spaceId: 'space-other-unit', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_IN, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'space-key' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.operationalPresenceEvent.create).not.toHaveBeenCalled();
  });

  it('rejeita sessão operacional pertencente a outra unidade', async () => {
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue(null);
    prisma.operationalPresenceSession.findFirst.mockResolvedValue(null);
    await expect(service.recordEvent({ unitId: 'unit-1', sessionId: 'session-other-unit', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_IN, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'session-key' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.operationalPresenceEvent.create).not.toHaveBeenCalled();
  });

  it('transforma corrida de idempotência em conflito', async () => {
    prisma.operationalPresenceEvent.findFirst.mockResolvedValue(null);
    let createCalls = 0;
    prisma.operationalPresenceEvent.create.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 1) return { id: 'event-1', status: 'ACCEPTED' };
      throw uniqueViolation();
    });
    const dto = { unitId: 'unit-1', subjectType: 'CHILD', subjectId: 'child-1', eventType: Onda2PresenceEventType.CHECK_IN, occurredAt: '2026-08-21T12:00:00.000Z', idempotencyKey: 'same-key', source: 'MOBILE' };
    const results = await Promise.allSettled([service.recordEvent(dto, actor), service.recordEvent(dto, actor)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected' && item.reason instanceof ConflictException)).toHaveLength(1);
    expect(createCalls).toBe(2);
  });

  it('rejeita espaço de sessão fora do escopo', async () => {
    prisma.operationalPresenceSession.findFirst.mockResolvedValue(null);
    prisma.facilitySpace.findFirst.mockResolvedValue(null);
    await expect(service.createSession({ unitId: 'unit-1', spaceId: 'space-other-unit', sessionDate: '2026-08-21T00:00:00.000Z' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.operationalPresenceSession.create).not.toHaveBeenCalled();
  });
});
